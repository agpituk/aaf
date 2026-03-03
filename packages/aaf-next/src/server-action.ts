import type { ActionMeta, WrappedServerAction } from './types.js';

// Registry of all actions decorated with withAgentAction
const actionRegistry = new Map<string, ActionMeta>();

/**
 * Wraps a Next.js Server Action with AAF metadata.
 * The original function is returned unchanged, but metadata is registered
 * for manifest generation via generateManifestFragment().
 *
 * No runtime overhead on the server — all agent metadata is static.
 */
export function withAgentAction(
  serverAction: (...args: any[]) => Promise<any>,
  meta: ActionMeta
): WrappedServerAction {
  actionRegistry.set(meta.action, meta);

  const wrapped = serverAction as WrappedServerAction;
  wrapped.__aaf_meta = meta;

  return wrapped;
}

/**
 * Generates agent-manifest.json entries from all registered withAgentAction() calls.
 * Call from next.config.js or a build script.
 */
export function generateManifestFragment(): {
  actions: Record<string, {
    title: string;
    scope: string;
    risk: string;
    confirmation: string;
    idempotent: boolean;
    inputSchema: object;
    outputSchema: object;
  }>;
} {
  const actions: Record<string, any> = {};

  for (const [actionId, meta] of actionRegistry) {
    actions[actionId] = {
      title: meta.action.split('.').map(s => s[0].toUpperCase() + s.slice(1)).join(' '),
      scope: meta.scope || actionId,
      risk: meta.risk || 'none',
      confirmation: meta.confirmation || 'optional',
      idempotent: meta.idempotent ?? false,
      inputSchema: meta.inputSchema || { type: 'object', properties: {} },
      outputSchema: meta.outputSchema || { type: 'object', properties: {} },
    };
  }

  return { actions };
}
