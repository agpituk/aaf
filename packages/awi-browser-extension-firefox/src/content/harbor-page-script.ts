/**
 * Page-context script injected into the web page.
 * Runs in the PAGE's JS context (not the content script's Xray sandbox),
 * so it can access window.ai injected by Harbor.
 *
 * Communication flow:
 *   Content script → CustomEvent('awi-harbor-request') → this script
 *   this script → window.ai.languageModel → CustomEvent('awi-harbor-response') → content script
 */

interface HarborRequest {
  requestId: string;
  userPrompt: string;
  systemPrompt: string;
}

interface HarborResponse {
  requestId: string;
  result?: string;
  error?: string;
}

document.addEventListener('awi-harbor-request', async (event: Event) => {
  const detail = (event as CustomEvent<HarborRequest>).detail;
  const { requestId, userPrompt, systemPrompt } = detail;

  const response: HarborResponse = { requestId };

  try {
    // Harbor injects window.ai with the Prompt API
    const ai = (window as unknown as { ai?: { languageModel?: { create(opts: { systemPrompt: string }): Promise<{ prompt(text: string): Promise<string>; destroy(): void }> } } }).ai;

    if (!ai?.languageModel) {
      response.error = 'Harbor not available: window.ai.languageModel not found. Is the Harbor extension installed and enabled?';
      document.dispatchEvent(new CustomEvent('awi-harbor-response', { detail: response }));
      return;
    }

    // Create a fresh session per request (system prompt may change between pages)
    const session = await ai.languageModel.create({ systemPrompt });
    try {
      response.result = await session.prompt(userPrompt);
    } finally {
      session.destroy();
    }
  } catch (err) {
    response.error = `Harbor error: ${(err as Error).message}`;
  }

  document.dispatchEvent(new CustomEvent('awi-harbor-response', { detail: response }));
});
