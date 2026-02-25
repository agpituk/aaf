import type { AgentManifest } from '@agent-native-web/runtime-core/types';
import { MANIFEST_PATH } from '../shared/constants.js';

/**
 * Fetches the agent manifest from the current origin's .well-known path.
 * Same-origin fetch, no CORS issues in content script context.
 */
export async function fetchManifest(): Promise<AgentManifest | null> {
  try {
    const url = `${window.location.origin}${MANIFEST_PATH}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data as AgentManifest;
  } catch {
    return null;
  }
}
