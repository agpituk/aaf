/** Well-known path for agent manifests */
export const MANIFEST_PATH = '/.well-known/agent-manifest.json';

/** CustomEvent names for Harbor bridge communication */
export const HARBOR_EVENTS = {
  REQUEST: 'awi-harbor-request',
  RESPONSE: 'awi-harbor-response',
} as const;

/** Extension storage keys */
export const STORAGE_KEYS = {
  CHAT_HISTORY: 'chat_history',
} as const;
