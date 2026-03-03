import type { AgentAction, PolicyCheckResult } from './types.js';

// Patterns that indicate CSS selectors, XPath, or DOM queries in arg values
const SELECTOR_PATTERNS = [
  /^[#.]\w/,                // .class or #id
  /^\[[\w-]+=/,             // [attr=value]
  /\s*>\s*/,                // child combinator
  /::?\w+/,                 // pseudo-elements/classes
  /^\/\//,                  // XPath expressions
  /^xpath\s*=/i,            // explicit xpath=
  /\s*~\s*/,               // general sibling combinator
  /\s*\+\s*/,              // adjacent sibling combinator
  /^\*$/,                   // universal selector
  /^(?:div|span|input|button|form|table|tr|td|th|ul|ol|li|h[1-6])(?:\s|$|[.#\[>~+:{])/i,
];

function looksLikeSelector(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return SELECTOR_PATTERNS.some((pattern) => pattern.test(value));
}

export interface CheckExecutionOptions {
  confirmed?: boolean;
  requiredFields?: Record<string, unknown>;
  args?: Record<string, unknown>;
  pageOrigin?: string;
  manifestOrigin?: string;
  agentScopes?: string[];
}

export class PolicyEngine {
  checkExecution(
    action: AgentAction,
    options: CheckExecutionOptions = {}
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

    // Check arg safety if args provided
    if (options.args) {
      const argCheck = this.checkArgSafety(options.args);
      if (!argCheck.allowed) return argCheck;
    }

    // Check origin trust if both origins provided
    if (options.manifestOrigin && options.pageOrigin) {
      const originCheck = this.checkOriginTrust(options.manifestOrigin, options.pageOrigin);
      if (!originCheck.allowed) return originCheck;
    }

    // Check scope if agent scopes provided
    if (options.agentScopes && action.scope) {
      const scopeCheck = this.checkScope(action.scope, options.agentScopes);
      if (!scopeCheck.allowed) return scopeCheck;
    }

    return { allowed: true };
  }

  /**
   * Check that all arg values are free of selector-like patterns.
   * Rejects values matching CSS selectors, pseudo-classes, or XPath expressions.
   */
  checkArgSafety(args: Record<string, unknown>): PolicyCheckResult {
    for (const [key, value] of Object.entries(args)) {
      if (looksLikeSelector(value)) {
        return {
          allowed: false,
          reason: `Arg "${key}" contains a selector-like value — agents must use semantic names, not selectors`,
        };
      }
      // Recursively check nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.checkArgSafety(value as Record<string, unknown>);
        if (!nested.allowed) return nested;
      }
    }
    return { allowed: true };
  }

  /**
   * Check that the manifest origin matches the current page origin.
   */
  checkOriginTrust(manifestOrigin: string, pageOrigin: string): PolicyCheckResult {
    if (manifestOrigin !== pageOrigin) {
      return {
        allowed: false,
        reason: `Manifest origin "${manifestOrigin}" does not match page origin "${pageOrigin}"`,
      };
    }
    return { allowed: true };
  }

  /**
   * Check that the requesting agent has the required scope for the action.
   */
  checkScope(actionScope: string, agentScopes: string[]): PolicyCheckResult {
    if (!agentScopes.includes(actionScope)) {
      return {
        allowed: false,
        reason: `Agent lacks required scope "${actionScope}". Granted scopes: ${agentScopes.join(', ') || '(none)'}`,
      };
    }
    return { allowed: true };
  }
}
