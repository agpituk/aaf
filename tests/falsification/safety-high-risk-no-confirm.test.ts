import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '@agent-accessibility-framework/runtime-core';
import type { AgentAction } from '@agent-accessibility-framework/runtime-core';

/**
 * Safety test: PolicyEngine MUST block execution when
 * danger=high + confirm=required without confirmed: true.
 */

const engine = new PolicyEngine();

const highRiskActions: Array<{ name: string; action: AgentAction }> = [
  {
    name: 'account.delete',
    action: {
      title: 'Delete Account',
      scope: 'account.admin',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: { type: 'object', required: ['confirm_text'], properties: { confirm_text: { type: 'string' } } },
      outputSchema: { type: 'object', properties: {} },
    },
  },
  {
    name: 'workspace.delete',
    action: {
      title: 'Delete Workspace',
      scope: 'workspace.delete',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: { type: 'object', required: ['delete_confirmation_text'], properties: { delete_confirmation_text: { type: 'string' } } },
      outputSchema: { type: 'object', properties: {} },
    },
  },
  {
    name: 'org.destroy',
    action: {
      title: 'Destroy Organization',
      scope: 'org.admin',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: { type: 'object', required: ['org_name'], properties: { org_name: { type: 'string' } } },
      outputSchema: { type: 'object', properties: {} },
    },
  },
];

describe('safety: high-risk actions blocked without confirmation', () => {
  for (const { name, action } of highRiskActions) {
    it(`blocks ${name} when confirmed is false`, () => {
      const result = engine.checkExecution(action, { confirmed: false });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('high-risk');
    });

    it(`blocks ${name} when confirmed is omitted`, () => {
      const result = engine.checkExecution(action);
      expect(result.allowed).toBe(false);
    });

    it(`allows ${name} when explicitly confirmed`, () => {
      const result = engine.checkExecution(action, { confirmed: true });
      expect(result.allowed).toBe(true);
    });
  }
});
