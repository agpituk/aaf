/**
 * Minimal Firefox browser.* API type declarations.
 * Firefox WebExtension APIs return Promises (unlike Chrome's callback style).
 */

declare namespace browser {
  namespace runtime {
    function sendMessage(message: unknown): Promise<unknown>;
    function getURL(path: string): string;

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: { tab?: { id?: number; url?: string } },
        ) => Promise<unknown> | void
      ): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      active?: boolean;
    }

    function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
  }

  namespace action {
    function setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    function setBadgeBackgroundColor(details: { color: string; tabId?: number }): Promise<void>;
  }

  namespace storage {
    const local: {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  }
}

/**
 * Firefox-specific: clones an object into the page's scope,
 * crossing the Xray wrapper boundary for content script ↔ page communication.
 * Returns undefined in non-Firefox environments (e.g., jsdom for testing).
 */
declare function cloneInto<T>(obj: T, targetScope: object, options?: { cloneFunctions?: boolean }): T;
