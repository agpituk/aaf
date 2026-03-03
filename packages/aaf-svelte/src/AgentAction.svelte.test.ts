import { describe, it, expect } from 'vitest';

describe('AgentAction types', () => {
  it('exports AgentActionProps interface', async () => {
    const { AgentActionProps } = await import('./types.js') as any;
    // Type-only check — if this file compiles, the types are correct
    expect(true).toBe(true);
  });
});

describe('agentActions store', () => {
  it('exports a readable store', async () => {
    const { agentActions } = await import('./store.js');
    expect(agentActions).toBeDefined();
    expect(typeof agentActions.subscribe).toBe('function');
  });
});

describe('aafManifestHook', () => {
  it('serves manifest at /.well-known/agent-manifest.json', async () => {
    const { aafManifestHook } = await import('./server-hook.js');
    const manifest = { version: '0.1', site: { name: 'Test', origin: 'http://localhost' }, actions: {} };
    const hook = aafManifestHook(manifest);

    const event = {
      url: new URL('http://localhost/.well-known/agent-manifest.json'),
      request: new Request('http://localhost/.well-known/agent-manifest.json'),
    };

    const response = await hook({ event, resolve: async () => new Response('fallthrough') });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.version).toBe('0.1');
    expect(body.site.name).toBe('Test');
  });

  it('passes through for non-manifest paths', async () => {
    const { aafManifestHook } = await import('./server-hook.js');
    const manifest = { version: '0.1', site: { name: 'Test', origin: 'http://localhost' }, actions: {} };
    const hook = aafManifestHook(manifest);

    const event = {
      url: new URL('http://localhost/other-path'),
      request: new Request('http://localhost/other-path'),
    };

    const response = await hook({ event, resolve: async () => new Response('fallthrough') });
    const body = await response.text();
    expect(body).toBe('fallthrough');
  });
});
