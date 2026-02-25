import { ChatPanel } from './components/chat-panel.js';
import { InspectorPanel } from './components/inspector-panel.js';

/**
 * Sidebar entry point: tab switching and component initialization.
 * No planner init here — planning happens in the content script via Harbor bridge.
 */
const chatPanel = new ChatPanel();
const inspectorPanel = new InspectorPanel();

// Tab switching
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
const panels = document.querySelectorAll<HTMLElement>('.panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetId = `${tab.dataset.tab}-panel`;

    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    panels.forEach((p) => {
      if (p.id === targetId) {
        p.classList.remove('hidden');
        p.classList.add('active');
      } else {
        p.classList.add('hidden');
        p.classList.remove('active');
      }
    });

    // Auto-scan when switching to inspector
    if (tab.dataset.tab === 'inspector') {
      inspectorPanel.scan();
    }
  });
});

// Log initialization
chatPanel.addMessage('system', 'AWI Agent (Harbor) ready. Type a message to interact with this page.');
