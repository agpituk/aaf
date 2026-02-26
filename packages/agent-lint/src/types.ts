export type Severity = 'error' | 'warning';

export interface LintResult {
  severity: Severity;
  message: string;
  source?: string;
  line?: number;
}

export type AuditCategory = 'forms' | 'fields' | 'actions' | 'safety' | 'manifest';

export interface AuditCheck {
  category: AuditCategory;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface CategoryScore {
  category: AuditCategory;
  score: number;
  checks: AuditCheck[];
}

export interface AuditResult {
  overallScore: number;
  categories: CategoryScore[];
  summary: string;
}
