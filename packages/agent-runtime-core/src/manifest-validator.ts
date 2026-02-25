import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { AgentManifest, AgentAction } from './types.js';
import { coerceArgs, type Coercion } from './coerce-args.js';

export class ManifestValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(this.ajv);
  }

  loadManifest(data: unknown): AgentManifest {
    if (!data || typeof data !== 'object') {
      throw new Error('Manifest must be a non-null object');
    }
    const manifest = data as AgentManifest;
    if (!manifest.version || !manifest.site || !manifest.actions) {
      throw new Error('Manifest missing required fields: version, site, actions');
    }
    return manifest;
  }

  getAction(manifest: AgentManifest, actionName: string): AgentAction {
    const action = manifest.actions[actionName];
    if (!action) {
      throw new Error(`Action "${actionName}" not found in manifest`);
    }
    return action;
  }

  validateInput(action: AgentAction, input: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const validate = this.ajv.compile(action.inputSchema);
    const valid = validate(input);
    if (!valid) {
      const errors = (validate.errors || []).map(
        (e) => `${e.instancePath || '/'}: ${e.message}`
      );
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  }

  coerceAndValidate(
    action: AgentAction,
    input: Record<string, unknown>,
  ): { valid: boolean; errors: string[]; coerced: Record<string, unknown>; coercions: Coercion[] } {
    const { args: coerced, coercions } = coerceArgs(input, action.inputSchema);
    const { valid, errors } = this.validateInput(action, coerced);
    return { valid, errors, coerced, coercions };
  }
}
