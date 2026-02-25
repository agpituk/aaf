import Ajv from 'ajv';
import type { PlannerRequest, RuntimeResponse, RuntimeStatus } from './types.js';
import plannerRequestSchema from './schemas/planner-request.schema.json';
import runtimeResponseSchema from './schemas/runtime-response.schema.json';

const VALID_STATUSES: Set<RuntimeStatus> = new Set([
  'completed',
  'needs_confirmation',
  'validation_error',
  'execution_error',
  'missing_required_fields',
]);

// Pattern to detect CSS selectors in args
const SELECTOR_PATTERNS = [
  /^[.#]\w/,          // .class or #id
  /^\[[\w-]+=/,       // [attr=value]
  /\s*>\s*/,          // child combinator
  /::?\w+/,           // pseudo-elements/classes
  /^(?:div|span|input|button|form|table|tr|td|th|ul|ol|li|h[1-6])(?:\s|$|[.#\[>~+:{])/i, // tag selectors with combinator/qualifier
];

function looksLikeSelector(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return SELECTOR_PATTERNS.some((pattern) => pattern.test(value));
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv({ strict: false, allErrors: true });
const validateRequestSchema = ajv.compile(plannerRequestSchema);
const validateResponseSchema = ajv.compile(runtimeResponseSchema);

/**
 * Validates a PlannerRequest:
 * - Must match JSON Schema (action + args required, no extra fields)
 * - Action name must be a dot-separated semantic identifier
 * - Args must not contain CSS selectors
 */
export function validatePlannerRequest(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request must be a non-null object'] };
  }

  // JSON Schema validation
  const schemaValid = validateRequestSchema(data);
  if (!schemaValid) {
    for (const err of validateRequestSchema.errors || []) {
      errors.push(`${err.instancePath || '/'}: ${err.message}`);
    }
    return { valid: false, errors };
  }

  const request = data as PlannerRequest;

  // Reject selector-like values in args
  for (const [key, value] of Object.entries(request.args)) {
    if (looksLikeSelector(value)) {
      errors.push(`args.${key}: value looks like a CSS selector — planners must use semantic field names, not selectors`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates a RuntimeResponse matches the expected schema.
 */
export function validateRuntimeResponse(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response must be a non-null object'] };
  }

  const schemaValid = validateResponseSchema(data);
  if (!schemaValid) {
    for (const err of validateResponseSchema.errors || []) {
      errors.push(`${err.instancePath || '/'}: ${err.message}`);
    }
    return { valid: false, errors };
  }

  const response = data as RuntimeResponse;

  if (!VALID_STATUSES.has(response.status)) {
    errors.push(`Invalid status: "${response.status}"`);
  }

  if (response.status === 'needs_confirmation' && !response.confirmation_metadata) {
    errors.push('needs_confirmation status requires confirmation_metadata');
  }

  if (response.status === 'missing_required_fields' && (!response.missing_fields || response.missing_fields.length === 0)) {
    errors.push('missing_required_fields status requires non-empty missing_fields array');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}
