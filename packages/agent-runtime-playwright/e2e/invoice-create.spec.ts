import { test, expect } from '@playwright/test';
import { ActionExecutor } from '../src/action-executor.js';
import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';

const manifest: AgentManifest = {
  version: '0.1',
  site: {
    name: 'Example Billing',
    origin: 'http://localhost:5174',
  },
  actions: {
    'invoice.create': {
      title: 'Create invoice',
      scope: 'invoices.write',
      risk: 'low',
      confirmation: 'optional',
      idempotent: false,
      inputSchema: {
        type: 'object',
        required: ['customer_email', 'amount', 'currency'],
        properties: {
          customer_email: { type: 'string', format: 'email' },
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', enum: ['EUR', 'USD'] },
          memo: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['invoice_id', 'status'],
        properties: {
          invoice_id: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'sent'] },
        },
      },
    },
  },
  pages: {
    '/invoices/new/': {
      title: 'Create Invoice',
      actions: ['invoice.create'],
    },
  },
};

test('executes invoice.create action via UI', async ({ page }) => {
  const executor = new ActionExecutor();

  const result = await executor.execute(page, {
    actionName: 'invoice.create',
    input: {
      customer_email: 'alice@example.com',
      amount: 120,
      currency: 'EUR',
      memo: 'Consulting',
    },
    baseUrl: 'http://localhost:5174',
    manifest,
  });

  // Check status message
  expect(result.status).toContain('created successfully');

  // Check execution log
  expect(result.log.action).toBe('invoice.create');
  expect(result.log.mode).toBe('ui');
  expect(result.log.steps.length).toBeGreaterThan(0);

  // Verify the log has the expected step types
  const stepTypes = result.log.steps.map((s) => s.type);
  expect(stepTypes).toContain('validate');
  expect(stepTypes).toContain('policy_check');
  expect(stepTypes).toContain('navigate');
  expect(stepTypes).toContain('fill');
  expect(stepTypes).toContain('click');
  expect(stepTypes).toContain('read_status');
});

test('rejects invalid input before interaction', async ({ page }) => {
  const executor = new ActionExecutor();

  await expect(
    executor.execute(page, {
      actionName: 'invoice.create',
      input: {
        customer_email: 'not-an-email',
        amount: 120,
        currency: 'EUR',
      },
      baseUrl: 'http://localhost:5174',
      manifest,
    })
  ).rejects.toThrow('Input validation failed');
});
