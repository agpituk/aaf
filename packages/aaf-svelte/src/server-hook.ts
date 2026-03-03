interface HandleInput {
  event: { url: URL; request: Request };
  resolve: (event: unknown) => Promise<Response>;
}

/**
 * SvelteKit server hook that serves the agent manifest at /.well-known/agent-manifest.json.
 *
 * Usage in src/hooks.server.ts:
 *   import { aafManifestHook } from '@agent-accessibility-framework/svelte';
 *   import manifest from './agent-manifest.json';
 *   export const handle = aafManifestHook(manifest);
 */
export function aafManifestHook(manifest: Record<string, unknown>) {
  return async ({ event, resolve }: HandleInput) => {
    if (event.url.pathname === '/.well-known/agent-manifest.json') {
      return new Response(JSON.stringify(manifest, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return resolve(event);
  };
}
