import type { AgentAction, PolicyCheckResult } from './types.js';

export class PolicyEngine {
  checkExecution(
    action: AgentAction,
    options: { confirmed?: boolean; requiredFields?: Record<string, unknown> } = {}
  ): PolicyCheckResult {
    // Block if high risk + confirmation required but not confirmed
    if (action.risk === 'high' && action.confirmation === 'required' && !options.confirmed) {
      return {
        allowed: false,
        reason: `Action "${action.title}" is high-risk and requires explicit confirmation`,
      };
    }

    // Validate required fields if inputSchema specifies them
    if (options.requiredFields && action.inputSchema) {
      const schema = action.inputSchema as { required?: string[] };
      if (schema.required) {
        for (const field of schema.required) {
          if (options.requiredFields[field] === undefined || options.requiredFields[field] === '') {
            return {
              allowed: false,
              reason: `Required field "${field}" is missing or empty`,
            };
          }
        }
      }
    }

    return { allowed: true };
  }
}
