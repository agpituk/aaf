import { HARBOR_EVENTS } from '../shared/constants.js';

let pageScriptInjected = false;

/**
 * Injects the page-level Harbor script that has access to window.ai.
 * The script is loaded from web_accessible_resources via browser.runtime.getURL.
 */
function injectPageScript(): void {
  if (pageScriptInjected) return;
  pageScriptInjected = true;

  const script = document.createElement('script');
  script.src = browser.runtime.getURL('harbor-page-script.js');
  script.type = 'module';
  document.head.appendChild(script);
}

let requestCounter = 0;

/**
 * Sends a prompt to Harbor (window.ai) via the injected page script.
 * Uses CustomEvents to cross the content script ↔ page boundary.
 *
 * @param userPrompt - The user prompt to send to the LLM
 * @param systemPrompt - The system prompt (action catalog context)
 * @returns The raw LLM response text
 */
export function generate(userPrompt: string, systemPrompt: string): Promise<string> {
  injectPageScript();

  const requestId = `awi-${++requestCounter}-${Date.now()}`;

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      document.removeEventListener(HARBOR_EVENTS.RESPONSE, handler);
      reject(new Error('Harbor bridge timeout: no response after 30s'));
    }, 30_000);

    function handler(event: Event) {
      const detail = (event as CustomEvent<{ requestId: string; result?: string; error?: string }>).detail;
      if (detail.requestId !== requestId) return; // Ignore unrelated responses

      clearTimeout(timeout);
      document.removeEventListener(HARBOR_EVENTS.RESPONSE, handler);

      if (detail.error) {
        reject(new Error(detail.error));
      } else {
        resolve(detail.result!);
      }
    }

    document.addEventListener(HARBOR_EVENTS.RESPONSE, handler);

    // Build the event detail, using cloneInto if available (Firefox Xray wrappers)
    const detail = { requestId, userPrompt, systemPrompt };
    const eventInit: CustomEventInit = {
      detail: typeof cloneInto === 'function'
        ? cloneInto(detail, document.defaultView as object)
        : detail,
    };

    document.dispatchEvent(new CustomEvent(HARBOR_EVENTS.REQUEST, eventInit));
  });
}
