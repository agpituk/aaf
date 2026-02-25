# Design Principles and Examples

## 16. MVP Rules (Keep It Small)

To avoid getting stuck, v0.1 should stay narrow.

### Include in v0.1

- `data-agent-action`
- `data-agent-field`
- `data-agent-kind`
- `data-agent-danger`
- `data-agent-confirm`
- `data-agent-scope`
- Manifest with JSON Schema-like input/output
- One runtime (Playwright)
- One generator (TS + Python + CLI)

### Exclude from v0.1

- Streaming actions
- Multi-page workflow graphs
- Browser-native support
- Official W3C proposal process
- Advanced auth protocols
- Full role modeling
- Localization semantics beyond field identifiers

---

## 17. Design Principles

1. **UI-first, not API-only** — Agent must be able to interact with the website itself
2. **Semantics over selectors** — `data-agent-field="customer_email"` beats `.input-primary:nth-child(2)`
3. **Safety by default** — Risk and confirmation are first-class
4. **Typed where it matters** — Manifest for validation and generation
5. **Progressive adoption** — Works with `data-*` today, no browser changes required initially
6. **Compatible with existing tools** — Can generate SDKs, CLIs, and MCP wrappers
7. **Do not break accessibility** — Complements ARIA, does not replace it

---

## 18. Example End-to-End Flow

### User Intent

> "Create an invoice for alice@example.com for 120 EUR"

### Agent Flow (UI mode)

1. Runtime loads page
2. Finds action `invoice.create`
3. Validates fields from manifest
4. Fills:
   - `customer_email`
   - `amount`
   - `currency`
5. Clicks `invoice.create.submit`
6. Reads `invoice.create.status`
7. Returns structured result

### Agent Flow (Generated CLI)

```bash
billing-agent invoice.create \
  --customer-email alice@example.com \
  --amount 120 \
  --currency EUR \
  --ui
```

### Agent Flow (MCP Bridge)

1. LLM calls MCP tool `invoice.create`
2. MCP wrapper uses runtime + semantics
3. Website is operated
4. Result returned to LLM
