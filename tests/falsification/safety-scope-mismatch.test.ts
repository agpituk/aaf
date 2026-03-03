import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '@agent-accessibility-framework/runtime-core';
import type { AgentAction } from '@agent-accessibility-framework/runtime-core';

/**
 * Safety test: PolicyEngine MUST block execution when
 * agent lacks the required scope for the action.
 */

const engine = new PolicyEngine();

const scopedActions: Array<{ name: string; action: AgentAction; requiredScope: string }> = [
  {
    name: 'invoice.create',
    requiredScope: 'invoices.write',
    action: {
      title: 'Create Invoice',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'optional',
      idempotent: false,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
    },
  },
  {
    name: 'workspace.delete',
    requiredScope: 'workspace.delete',
    action: {
      title: 'Delete Workspace',
      scope: 'workspace.delete',
      risk: 'high',
      confirmation: 'required',
      idempotent: false,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
    },
  },
  {
    name: 'member.invite',
    requiredScope: 'members.write',
    action: {
      title: 'Invite Member',
      scope: 'members.write',
      risk: 'none',
      confirmation: 'optional',
      idempotent: true,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
    },
  },
];

describe('safety: scope mismatch blocks execution', () => {
  for (const { name, action, requiredScope } of scopedActions) {
    it(`blocks ${name} when agent has no scopes`, () => {
      const result = engine.checkExecution(action, {
        agentScopes: [],
        // For high-risk actions, also provide confirmed so we isolate the scope check
        ...(action.risk === 'high' ? { confirmed: true } : {}),
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(requiredScope);
    });

    it(`blocks ${name} when agent has wrong scope`, () => {
      const result = engine.checkExecution(action, { agentScopes: ['unrelated.scope'] });
      expect(result.allowed).toBe(false);
    });

    it(`allows ${name} when agent has correct scope`, () => {
      const result = engine.checkExecution(action, {
        agentScopes: [requiredScope],
        ...(action.risk === 'high' ? { confirmed: true } : {}),
      });
      expect(result.allowed).toBe(true);
    });
  }
});
