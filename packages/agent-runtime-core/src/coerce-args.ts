/**
 * Unified arg coercion layer — fixes LLM type mismatches against JSON Schema.
 * Zero AJV dependency (safe for Firefox extension CSP).
 */

export interface Coercion {
  field: string;
  from: unknown;
  to: unknown;
  rule: string;
}

export interface CoerceResult {
  args: Record<string, unknown>;
  coercions: Coercion[];
}

interface SchemaProperty {
  type?: string;
  enum?: string[];
}

interface InputSchema {
  properties?: Record<string, SchemaProperty>;
}

/**
 * Coerce LLM args to match the inputSchema types.
 *
 * Rules:
 * - string → number when prop.type === 'number' (skip NaN)
 * - string → integer when prop.type === 'integer' (skip non-integers)
 * - string → boolean when prop.type === 'boolean' ("true"/"false" only)
 * - Enum case-fix: case-insensitive match against prop.enum
 * - null → delete from args (LLM null = field not provided)
 *
 * Returns a new args object (never mutates the input).
 */
export function coerceArgs(
  args: Record<string, unknown>,
  inputSchema: Record<string, unknown>,
): CoerceResult {
  const schema = inputSchema as InputSchema;
  if (!schema.properties) {
    return { args: { ...args }, coercions: [] };
  }

  const coerced: Record<string, unknown> = { ...args };
  const coercions: Coercion[] = [];

  for (const [key, value] of Object.entries(args)) {
    const prop = schema.properties[key];

    // null → delete (LLM null = field not provided)
    if (value === null) {
      delete coerced[key];
      coercions.push({ field: key, from: null, to: undefined, rule: 'null→delete' });
      continue;
    }

    if (!prop || value === undefined) continue;

    // string → number
    if (prop.type === 'number' && typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num)) {
        coerced[key] = num;
        coercions.push({ field: key, from: value, to: num, rule: 'string→number' });
      }
    }

    // string → integer
    if (prop.type === 'integer' && typeof value === 'string') {
      const num = Number(value);
      if (!isNaN(num) && Number.isInteger(num)) {
        coerced[key] = num;
        coercions.push({ field: key, from: value, to: num, rule: 'string→integer' });
      }
    }

    // string → boolean
    if (prop.type === 'boolean' && typeof value === 'string') {
      if (value === 'true') {
        coerced[key] = true;
        coercions.push({ field: key, from: value, to: true, rule: 'string→boolean' });
      } else if (value === 'false') {
        coerced[key] = false;
        coercions.push({ field: key, from: value, to: false, rule: 'string→boolean' });
      }
    }

    // Enum case-fix
    if (prop.enum && typeof value === 'string') {
      const match = prop.enum.find(
        (e) => e.toLowerCase() === value.toLowerCase(),
      );
      if (match && match !== value) {
        coerced[key] = match;
        coercions.push({ field: key, from: value, to: match, rule: 'enum-case-fix' });
      }
    }
  }

  return { args: coerced, coercions };
}
