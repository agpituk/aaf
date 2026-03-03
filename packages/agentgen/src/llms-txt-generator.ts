import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';

/**
 * Generates an llms.txt file from an AAF agent manifest.
 * llms.txt is the emerging convention for making sites discoverable
 * by AI crawlers and external LLMs.
 */
export function generateLlmsTxt(manifest: AgentManifest): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${manifest.site.name}`);
  if (manifest.site.description) {
    lines.push(`> ${manifest.site.description}`);
  }
  lines.push('');

  // Actions
  if (Object.keys(manifest.actions).length > 0) {
    lines.push('## Actions');
    for (const [actionId, action] of Object.entries(manifest.actions)) {
      const parts: string[] = [];

      // Description
      const desc = action.description || action.title;
      parts.push(desc);

      // Required fields
      const schema = action.inputSchema as { required?: string[] };
      if (schema.required && schema.required.length > 0) {
        parts.push(`Requires: ${schema.required.join(', ')}.`);
      }

      // Risk
      const riskLabel = action.risk === 'high' ? 'HIGH' : action.risk;
      parts.push(`Risk: ${riskLabel}.`);

      // Confirmation
      if (action.confirmation === 'required') {
        parts.push('Requires explicit confirmation.');
      }

      lines.push(`- ${actionId}: ${parts.join(' ')}`);
    }
    lines.push('');
  }

  // Data views
  if (manifest.data && Object.keys(manifest.data).length > 0) {
    lines.push('## Data');
    for (const [dataId, dataView] of Object.entries(manifest.data)) {
      const desc = dataView.description || dataView.title;
      lines.push(`- ${dataId}: ${desc}`);
    }
    lines.push('');
  }

  // Pages
  if (manifest.pages && Object.keys(manifest.pages).length > 0) {
    lines.push('## Pages');
    for (const [route, page] of Object.entries(manifest.pages)) {
      const parts: string[] = [];
      if (page.actions && page.actions.length > 0) {
        parts.push(`actions: ${page.actions.join(', ')}`);
      }
      if (page.data && page.data.length > 0) {
        parts.push(`data: ${page.data.join(', ')}`);
      }
      const suffix = parts.length > 0 ? ` (${parts.join('; ')})` : '';
      lines.push(`- ${route}: ${page.title}${suffix}`);
    }
    lines.push('');
  }

  // Manifest location
  lines.push('## Manifest');
  lines.push('/.well-known/agent-manifest.json');
  lines.push('');

  return lines.join('\n');
}
