# Billing App — Agent-Native Web Sample

A sample billing application demonstrating Agent-Native Web DOM annotations (`data-agent-*`) and a typed capability manifest.

## Pages

- `/invoices/new` — Create invoice form with semantic fields
- `/invoices/` — List invoices with collection/item annotations
- `/settings/` — Workspace settings with dangerous delete action

## Running

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Agent Manifest

Available at `/.well-known/agent-manifest.json` when the dev server is running.
