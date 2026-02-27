import type { AuditResult, AuditCheck, CategoryScore, AuditCategory } from './types.js';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export interface AuditOptions {
  manifest?: Record<string, unknown>;
  /** Include safety checks (dangerous button annotations). Off by default. */
  safety?: boolean;
}

const CATEGORY_WEIGHTS: Record<AuditCategory, number> = {
  forms: 0.20,
  fields: 0.20,
  actions: 0.15,
  navigation: 0.15,
  safety: 0.20,
  manifest: 0.10,
};

const DANGEROUS_WORDS = /\b(delete|remove|destroy|drop|purge|erase|reset|revoke|terminate|cancel)\b/i;

const FORM_REGEX = /<form\b[^>]*>/gi;
const FORM_WITH_ACTION_REGEX = /<form\b[^>]*data-agent-action="[^"]*"[^>]*>/gi;

const INPUT_REGEX = /<(?:input|select|textarea)\b[^>]*>/gi;
const HIDDEN_OR_SUBMIT_REGEX = /type\s*=\s*"(?:hidden|submit)"/i;
const INPUT_WITH_FIELD_REGEX = /data-agent-field="[^"]*"/i;

const BUTTON_REGEX = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
const BUTTON_WITH_ACTION_REGEX = /data-agent-action="[^"]*"/i;
const BUTTON_WITH_DANGER_REGEX = /data-agent-danger="[^"]*"/i;
const BUTTON_WITH_CONFIRM_REGEX = /data-agent-confirm="[^"]*"/i;

function auditForms(html: string): CategoryScore {
  const checks: AuditCheck[] = [];
  const forms = html.match(FORM_REGEX) || [];
  const annotatedForms = html.match(FORM_WITH_ACTION_REGEX) || [];

  if (forms.length === 0) {
    checks.push({
      category: 'forms',
      check: 'forms_present',
      status: 'pass',
      message: 'No forms found (nothing to annotate)',
    });
    return { category: 'forms', score: 100, checks, empty: true };
  }

  const annotatedCount = annotatedForms.length;
  const totalCount = forms.length;
  const ratio = annotatedCount / totalCount;

  if (ratio === 1) {
    checks.push({
      category: 'forms',
      check: 'forms_annotated',
      status: 'pass',
      message: `All ${totalCount} form(s) have data-agent-action`,
    });
  } else {
    const missing = totalCount - annotatedCount;
    checks.push({
      category: 'forms',
      check: 'forms_annotated',
      status: missing === totalCount ? 'fail' : 'warning',
      message: `${missing} of ${totalCount} form(s) missing data-agent-action`,
    });
  }

  return { category: 'forms', score: Math.round(ratio * 100), checks };
}

function auditFields(html: string): CategoryScore {
  const checks: AuditCheck[] = [];
  const allInputs = html.match(INPUT_REGEX) || [];
  const relevantInputs = allInputs.filter((tag) => !HIDDEN_OR_SUBMIT_REGEX.test(tag));

  if (relevantInputs.length === 0) {
    checks.push({
      category: 'fields',
      check: 'fields_present',
      status: 'pass',
      message: 'No visible input fields found (nothing to annotate)',
    });
    return { category: 'fields', score: 100, checks, empty: true };
  }

  const annotated = relevantInputs.filter((tag) => INPUT_WITH_FIELD_REGEX.test(tag));
  const ratio = annotated.length / relevantInputs.length;

  if (ratio === 1) {
    checks.push({
      category: 'fields',
      check: 'fields_annotated',
      status: 'pass',
      message: `All ${relevantInputs.length} field(s) have data-agent-field`,
    });
  } else {
    const missing = relevantInputs.length - annotated.length;
    checks.push({
      category: 'fields',
      check: 'fields_annotated',
      status: missing === relevantInputs.length ? 'fail' : 'warning',
      message: `${missing} of ${relevantInputs.length} field(s) missing data-agent-field`,
    });
  }

  return { category: 'fields', score: Math.round(ratio * 100), checks };
}

function auditActions(html: string): CategoryScore {
  const checks: AuditCheck[] = [];
  let match: RegExpExecArray | null;

  const buttonRegex = new RegExp(BUTTON_REGEX.source, BUTTON_REGEX.flags);
  const buttons: Array<{ tag: string; text: string }> = [];
  while ((match = buttonRegex.exec(html)) !== null) {
    buttons.push({ tag: match[0], text: stripTags(match[1]) });
  }

  // Filter to action-like buttons (non-empty text, not just whitespace)
  const actionButtons = buttons.filter((b) => b.text.length > 0);

  if (actionButtons.length === 0) {
    checks.push({
      category: 'actions',
      check: 'actions_present',
      status: 'pass',
      message: 'No action buttons found (nothing to annotate)',
    });
    return { category: 'actions', score: 100, checks, empty: true };
  }

  const annotated = actionButtons.filter((b) => BUTTON_WITH_ACTION_REGEX.test(b.tag));
  const ratio = annotated.length / actionButtons.length;

  if (ratio === 1) {
    checks.push({
      category: 'actions',
      check: 'buttons_annotated',
      status: 'pass',
      message: `All ${actionButtons.length} button(s) have data-agent-action`,
    });
  } else {
    const missing = actionButtons.length - annotated.length;
    checks.push({
      category: 'actions',
      check: 'buttons_annotated',
      status: missing === actionButtons.length ? 'fail' : 'warning',
      message: `${missing} of ${actionButtons.length} button(s) missing data-agent-action`,
    });
  }

  return { category: 'actions', score: Math.round(ratio * 100), checks };
}

const ANCHOR_REGEX = /<a\b[^>]*href="[^"]*"[^>]*>/gi;
const ANCHOR_WITH_LINK_KIND_REGEX = /<a\b[^>]*data-agent-kind="link"[^>]*>/gi;

function auditNavigation(html: string): CategoryScore {
  const checks: AuditCheck[] = [];
  const allAnchors = html.match(ANCHOR_REGEX) || [];
  const annotatedAnchors = html.match(ANCHOR_WITH_LINK_KIND_REGEX) || [];

  if (allAnchors.length === 0) {
    checks.push({
      category: 'navigation',
      check: 'links_present',
      status: 'pass',
      message: 'No links found (nothing to annotate)',
    });
    return { category: 'navigation', score: 100, checks, empty: true };
  }

  const ratio = annotatedAnchors.length / allAnchors.length;

  if (ratio === 1) {
    checks.push({
      category: 'navigation',
      check: 'links_annotated',
      status: 'pass',
      message: `All ${allAnchors.length} link(s) have data-agent-kind="link"`,
    });
  } else {
    const missing = allAnchors.length - annotatedAnchors.length;
    checks.push({
      category: 'navigation',
      check: 'links_annotated',
      status: missing === allAnchors.length ? 'fail' : 'warning',
      message: `${missing} of ${allAnchors.length} link(s) missing data-agent-kind="link"`,
    });
  }

  return { category: 'navigation', score: Math.round(ratio * 100), checks };
}

function auditSafety(html: string): CategoryScore {
  const checks: AuditCheck[] = [];
  let match: RegExpExecArray | null;

  const buttonRegex = new RegExp(BUTTON_REGEX.source, BUTTON_REGEX.flags);
  const allButtons: Array<{ tag: string; text: string }> = [];
  const dangerousButtons: Array<{ tag: string; text: string }> = [];
  while ((match = buttonRegex.exec(html)) !== null) {
    const text = stripTags(match[1]);
    allButtons.push({ tag: match[0], text });
    if (DANGEROUS_WORDS.test(text)) {
      dangerousButtons.push({ tag: match[0], text });
    }
  }

  if (dangerousButtons.length === 0) {
    checks.push({
      category: 'safety',
      check: 'dangerous_buttons',
      status: 'pass',
      message: 'No dangerous-looking buttons found',
    });
    // Nothing dangerous to guard → not applicable to scoring
    return { category: 'safety', score: 100, checks, empty: true };
  }

  let safeCount = 0;
  for (const btn of dangerousButtons) {
    const hasDanger = BUTTON_WITH_DANGER_REGEX.test(btn.tag);
    const hasConfirm = BUTTON_WITH_CONFIRM_REGEX.test(btn.tag);
    if (hasDanger && hasConfirm) {
      checks.push({
        category: 'safety',
        check: `safety_${btn.text.toLowerCase().replace(/\s+/g, '_')}`,
        status: 'pass',
        message: `Button "${btn.text}" has danger and confirm annotations`,
      });
      safeCount++;
    } else {
      const missing = [];
      if (!hasDanger) missing.push('data-agent-danger');
      if (!hasConfirm) missing.push('data-agent-confirm');
      checks.push({
        category: 'safety',
        check: `safety_${btn.text.toLowerCase().replace(/\s+/g, '_')}`,
        status: 'fail',
        message: `Button "${btn.text}" looks dangerous but missing ${missing.join(', ')}`,
      });
    }
  }

  const ratio = safeCount / dangerousButtons.length;
  return { category: 'safety', score: Math.round(ratio * 100), checks };
}

function auditManifest(options?: AuditOptions): CategoryScore {
  const checks: AuditCheck[] = [];

  if (!options?.manifest) {
    checks.push({
      category: 'manifest',
      check: 'manifest_present',
      status: 'fail',
      message: 'No agent manifest provided',
    });
    return { category: 'manifest', score: 0, checks };
  }

  const manifest = options.manifest;
  let score = 50; // base score for having a manifest

  const hasActions = manifest.actions !== undefined;
  if (manifest.version && manifest.site && hasActions) {
    checks.push({
      category: 'manifest',
      check: 'manifest_valid',
      status: 'pass',
      message: 'Manifest has required fields (version, site, actions)',
    });
    score = 100;
  } else {
    const missing = [];
    if (!manifest.version) missing.push('version');
    if (!manifest.site) missing.push('site');
    if (!hasActions) missing.push('actions');
    checks.push({
      category: 'manifest',
      check: 'manifest_valid',
      status: 'warning',
      message: `Manifest missing fields: ${missing.join(', ')}`,
    });
  }

  return { category: 'manifest', score, checks };
}

export function scoreSummary(score: number): string {
  if (score >= 90) return 'Excellent agent accessibility';
  if (score >= 70) return 'Good agent accessibility with room for improvement';
  if (score >= 50) return 'Partial agent accessibility — significant gaps';
  return 'Poor agent accessibility — most elements lack annotations';
}

export function auditHTML(html: string, options?: AuditOptions): AuditResult {
  const categories: CategoryScore[] = [
    auditForms(html),
    auditFields(html),
    auditActions(html),
    auditNavigation(html),
    ...(options?.safety ? [auditSafety(html)] : []),
    auditManifest(options),
  ];

  // Exclude empty categories (nothing found to check) from the weighted average.
  // Redistribute their weight proportionally among applicable categories.
  const applicable = categories.filter((c) => !c.empty);
  const totalWeight = applicable.reduce((sum, c) => sum + CATEGORY_WEIGHTS[c.category], 0);

  const overallScore = totalWeight === 0
    ? 0
    : Math.round(
        applicable.reduce(
          (sum, cat) => sum + cat.score * (CATEGORY_WEIGHTS[cat.category] / totalWeight),
          0,
        ),
      );

  return {
    overallScore,
    categories,
    summary: scoreSummary(overallScore),
  };
}
