import { MSG } from '../shared/messages.js';
import type { ExtensionMessage } from '../shared/messages.js';

/**
 * Background script: routes messages between sidebar and content script.
 * Uses Firefox's promise-based browser.* APIs (no callback hacks).
 */
browser.runtime.onMessage.addListener(
  (message: unknown, sender: { tab?: { id?: number } }): Promise<unknown> | void => {
    const msg = message as ExtensionMessage;

    // Messages from content script about AWI detection
    if (msg.type === MSG.AWI_DETECTED) {
      if (sender.tab?.id) {
        browser.browserAction.setBadgeText({ text: 'AWI', tabId: sender.tab.id });
        browser.browserAction.setBadgeBackgroundColor({ color: '#4CAF50', tabId: sender.tab.id });
      }
      return;
    }

    // Forward sidebar messages to the active tab's content script
    if (
      msg.type === MSG.PLAN_AND_EXECUTE ||
      msg.type === MSG.EXECUTE_CONFIRMED ||
      msg.type === MSG.DISCOVER_ACTIONS ||
      msg.type === MSG.DETECT_AWI
    ) {
      return forwardToActiveTab(msg);
    }
  }
);

async function forwardToActiveTab(message: ExtensionMessage): Promise<unknown> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (!tabId) {
    return { error: 'No active tab' };
  }
  return browser.tabs.sendMessage(tabId, message);
}
