import type { ExecutionLog, LogStep } from './types.js';

export class ExecutionLogger {
  private sessionId: string;
  private action: string;
  private mode: 'ui' | 'direct';
  private steps: LogStep[] = [];

  constructor(action: string, mode: 'ui' | 'direct' = 'ui') {
    this.sessionId = `s_${Date.now().toString(36)}`;
    this.action = action;
    this.mode = mode;
  }

  navigate(url: string): void {
    this.steps.push({ type: 'navigate', url });
  }

  fill(field: string, value: unknown): void {
    this.steps.push({ type: 'fill', field, value });
  }

  click(action: string): void {
    this.steps.push({ type: 'click', action });
  }

  readStatus(output: string, value: unknown): void {
    this.steps.push({ type: 'read_status', output, value });
  }

  validate(result: string): void {
    this.steps.push({ type: 'validate', result });
  }

  policyCheck(result: string, error?: string): void {
    this.steps.push({ type: 'policy_check', result, error });
  }

  toLog(): ExecutionLog {
    return {
      session_id: this.sessionId,
      action: this.action,
      mode: this.mode,
      steps: [...this.steps],
      timestamp: new Date().toISOString(),
    };
  }
}
