import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isWebMCPAvailable, registerAAFTools, unregisterAAFTools } from './bridge.js';

describe('isWebMCPAvailable', () => {
  it('returns false when navigator.modelContext is absent', () => {
    expect(isWebMCPAvailable()).toBe(false);
  });
});

describe('registerAAFTools', () => {
  it('returns empty array when WebMCP is unavailable', async () => {
    const result = await registerAAFTools();
    expect(result).toEqual([]);
  });

  it('returns empty array with custom options when WebMCP is unavailable', async () => {
    const result = await registerAAFTools({
      manifestUrl: '/custom/manifest.json',
      actionsFilter: ['invoice.create'],
    });
    expect(result).toEqual([]);
  });
});

describe('unregisterAAFTools', () => {
  it('does nothing when WebMCP is unavailable', async () => {
    // Should not throw
    await unregisterAAFTools();
  });
});

describe('registerAAFTools with mock WebMCP', () => {
  const mockRegisterTool = vi.fn();
  const mockUnregisterTool = vi.fn();

  beforeEach(() => {
    // Mock navigator.modelContext
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        modelContext: {
          registerTool: mockRegisterTool,
          unregisterTool: mockUnregisterTool,
        },
      },
      writable: true,
      configurable: true,
    });

    // Mock fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '0.1',
        site: { name: 'Test', origin: 'http://localhost' },
        actions: {
          'invoice.create': {
            title: 'Create Invoice',
            description: 'Creates an invoice',
            scope: 'invoices.write',
            risk: 'low',
            confirmation: 'optional',
            idempotent: false,
            inputSchema: {
              type: 'object',
              properties: { customer_email: { type: 'string' } },
            },
          },
          'workspace.delete': {
            title: 'Delete Workspace',
            description: 'Deletes workspace permanently',
            scope: 'workspace.delete',
            risk: 'high',
            confirmation: 'required',
            idempotent: false,
            inputSchema: {
              type: 'object',
              properties: { confirm: { type: 'string' } },
            },
          },
        },
      }),
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: '' },
      writable: true,
      configurable: true,
    });
  });

  it('registers all actions as WebMCP tools', async () => {
    const registered: string[] = [];
    const result = await registerAAFTools({
      onRegister: (name) => registered.push(name),
    });

    expect(result).toEqual(['invoice.create', 'workspace.delete']);
    expect(registered).toEqual(['invoice.create', 'workspace.delete']);
    expect(mockRegisterTool).toHaveBeenCalledTimes(2);
  });

  it('filters actions when actionsFilter is provided', async () => {
    const result = await registerAAFTools({
      actionsFilter: ['invoice.create'],
    });

    expect(result).toEqual(['invoice.create']);
    expect(mockRegisterTool).toHaveBeenCalledTimes(1);
  });

  it('passes correct tool definition to registerTool', async () => {
    await registerAAFTools();

    const firstCall = mockRegisterTool.mock.calls[0];
    expect(firstCall[0].name).toBe('invoice.create');
    expect(firstCall[0].description).toBe('Creates an invoice');
    expect(firstCall[0].parameters.type).toBe('object');
  });

  it('high-risk tool handler returns confirmation_required error', async () => {
    await registerAAFTools();

    // Find the workspace.delete handler (second call)
    const handler = mockRegisterTool.mock.calls[1][1];
    const result = await handler({ confirm: 'DELETE' });

    expect(result.error).toBe('confirmation_required');
    expect(result.action).toBe('workspace.delete');
  });

  it('low-risk tool handler returns pending_execution', async () => {
    await registerAAFTools();

    // Find the invoice.create handler (first call)
    const handler = mockRegisterTool.mock.calls[0][1];
    const result = await handler({ customer_email: 'test@test.com' });

    expect(result.status).toBe('pending_execution');
    expect(result.action).toBe('invoice.create');
  });

  it('unregisters all tools', async () => {
    await registerAAFTools();
    await unregisterAAFTools();

    expect(mockUnregisterTool).toHaveBeenCalledTimes(2);
  });

  it('uses custom manifest URL', async () => {
    await registerAAFTools({ manifestUrl: '/custom/manifest.json' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/custom/manifest.json');
  });
});
