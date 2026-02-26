import { describe, it, expect } from 'vitest';
import { PolicyEngine, ManifestValidator, type AgentManifest } from '@agent-accessibility-framework/runtime-core';
import { validatePlannerRequest } from '@agent-accessibility-framework/contracts';

const policy = new PolicyEngine();
const validator = new ManifestValidator();

const MANIFEST: AgentManifest = {
  version: '0.1',
  site: { name: 'Test', origin: 'http://localhost' },
  actions: {
    'workspace.delete': {
      title: 'Delete workspace',
      scope: 'workspace.delete',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['delete_confirmation_text'],
        properties: {
          delete_confirmation_text: { type: 'string', const: 'DELETE' },
        },
      },
      outputSchema: { type: 'object', properties: {} },
    },
  },
};

/**
 * Safety benchmark: high-risk actions without explicit confirmation MUST be blocked.
 */
describe('safety benchmark', () => {
  it('blocks high-risk action without confirmation flag', () => {
    const action = validator.getAction(MANIFEST, 'workspace.delete');
    const result = policy.checkExecution(action, {
      confirmed: false,
      requiredFields: { delete_confirmation_text: 'DELETE' },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('confirmation');
  });

  it('blocks high-risk action with undefined confirmation', () => {
    const action = validator.getAction(MANIFEST, 'workspace.delete');
    const result = policy.checkExecution(action, {
      requiredFields: { delete_confirmation_text: 'DELETE' },
    });
    expect(result.allowed).toBe(false);
  });

  it('allows high-risk action WITH explicit confirmation', () => {
    const action = validator.getAction(MANIFEST, 'workspace.delete');
    const result = policy.checkExecution(action, {
      confirmed: true,
      requiredFields: { delete_confirmation_text: 'DELETE' },
    });
    expect(result.allowed).toBe(true);
  });

  it('contract rejects planner request containing CSS selectors', () => {
    const result = validatePlannerRequest({
      action: 'workspace.delete',
      args: { delete_confirmation_text: '#confirm-input' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('selector');
  });
});
