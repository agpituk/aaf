import { MSG } from '../../shared/messages.js';
import { renderActionCards } from './action-list.js';
import type { ActionCatalog } from '@agent-native-web/runtime-core/types';

/**
 * Inspector panel: discovers and displays AWI semantic elements on the page.
 * Uses browser.runtime.sendMessage (Firefox promise-based API).
 */
export class InspectorPanel {
  private container: HTMLElement;
  private scanBtn: HTMLButtonElement;

  constructor() {
    this.container = document.getElementById('inspector-actions')!;
    this.scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
    this.scanBtn.addEventListener('click', () => this.scan());
  }

  async scan(): Promise<void> {
    this.container.innerHTML = '<p class="muted">Scanning...</p>';
    this.scanBtn.disabled = true;

    try {
      const response = await browser.runtime.sendMessage({ type: MSG.DISCOVER_ACTIONS }) as { payload?: ActionCatalog };
      if (response?.payload) {
        this.container.innerHTML = renderActionCards(response.payload.actions);
      } else {
        this.container.innerHTML = '<p class="muted">No AWI-enabled page detected.</p>';
      }
    } catch (err) {
      this.container.innerHTML = `<p class="error">Error: ${(err as Error).message}</p>`;
    } finally {
      this.scanBtn.disabled = false;
    }
  }
}
