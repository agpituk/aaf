# Billing App — Agent-Native Web Sample

A sample billing application demonstrating Agent-Native Web DOM annotations (`data-agent-*`) and a typed capability manifest. Includes the embedded AWI agent widget for chat-driven interaction.

## Pages

- `/invoices/new` — Create invoice form with semantic fields
- `/invoices/` — List invoices with collection/item annotations
- `/settings/` — Workspace settings with dangerous delete action

All pages include the AWI agent widget (`<script type="module" src="/awi-agent.js">`), which adds a floating chat panel in the bottom-right corner.

## Running

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Agent Widget

The agent widget appears as a chat bubble on every page. Click it to open the chat panel.

**With Harbor (Firefox):** Uses `window.ai` for local LLM inference. The widget auto-detects Harbor and shows a "Harbor" badge.

**With Ollama:** If Harbor is unavailable but Ollama is running locally (`localhost:11434`), the widget falls back to direct Ollama API calls.

**Without any LLM:** The widget enters inspector-only mode, showing discovered actions and fields on the page.

### Try it

1. Navigate to `/invoices/new`
2. Click the chat bubble
3. Type: "Create an invoice for alice@example.com for 120 EUR"
4. Watch the form fill automatically and submit

For the high-risk confirmation flow:

1. Navigate to `/settings/`
2. Type: "Delete the workspace"
3. A confirmation dialog appears inside the widget before execution

## Agent Manifest

Available at `/.well-known/agent-manifest.json` when the dev server is running.
