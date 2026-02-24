export type Severity = 'error' | 'warning';

export interface LintResult {
  severity: Severity;
  message: string;
  source?: string;
  line?: number;
}
