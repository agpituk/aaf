import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { LintResult } from './types.js';

export function lintManifest(manifest: unknown, schema: Record<string, unknown>, source?: string): LintResult[] {
  const results: LintResult[] = [];
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(manifest);

  if (!valid && validate.errors) {
    for (const err of validate.errors) {
      results.push({
        severity: 'error',
        message: `${err.instancePath || '/'}: ${err.message}`,
        source,
      });
    }
  }

  return results;
}
