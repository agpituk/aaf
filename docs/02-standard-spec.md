# Standard Proposal v0.1

## 6.1 DOM Annotations (prototype using `data-agent-*`)

We start with `data-*` attributes because they work today without browser changes.

### Proposed Attributes

#### `data-agent-kind`

Declares the semantic type of element.

Allowed values:

- `action`
- `field`
- `status`
- `result`
- `collection`
- `item`
- `dialog`
- `step`

#### `data-agent-action`

Logical action identifier.

Examples:

- `invoice.create`
- `invoice.create.submit`
- `workspace.delete`
- `doc.export.pdf`

#### `data-agent-field`

Logical field identifier.

Examples:

- `customer_email`
- `amount`
- `currency`
- `delete_confirmation_text`

#### `data-agent-danger`

Risk level for action.

Allowed values:

- `none`
- `low`
- `high`

#### `data-agent-confirm`

Confirmation policy.

Allowed values:

- `never`
- `optional`
- `review` — agent fills the form but does not submit; the user reviews and submits manually
- `required`

#### `data-agent-scope`

Permission hint required for the action.

Examples:

- `invoices.write`
- `workspace.delete`
- `docs.export`

#### `data-agent-idempotent`

Whether repeated execution is safe.

Allowed values:

- `true`
- `false`

#### `data-agent-output`

Hint about result type or schema name.

Examples:

- `invoice`
- `invoice.create.status`
- `workspace.delete.result`

#### `data-agent-for-action`

Links a field/status to an action if not nested directly.

#### `data-agent-version`

Semantics version on container/root.

Example: `0.1`

---

## 6.2 Example: Invoice Create Form (DOM)

```html
<form
  data-agent-kind="action"
  data-agent-action="invoice.create"
  data-agent-scope="invoices.write"
  data-agent-danger="low"
  data-agent-confirm="optional"
  data-agent-idempotent="false"
  data-agent-version="0.1"
>
  <input
    type="email"
    name="email"
    aria-label="Customer email"
    data-agent-kind="field"
    data-agent-field="customer_email"
  />

  <input
    type="number"
    name="amount"
    min="0"
    step="0.01"
    aria-label="Amount"
    data-agent-kind="field"
    data-agent-field="amount"
  />

  <select
    name="currency"
    aria-label="Currency"
    data-agent-kind="field"
    data-agent-field="currency"
  >
    <option value="EUR">EUR</option>
    <option value="USD">USD</option>
  </select>

  <textarea
    name="memo"
    aria-label="Memo"
    data-agent-kind="field"
    data-agent-field="memo"
  ></textarea>

  <button
    type="submit"
    data-agent-kind="action"
    data-agent-action="invoice.create.submit"
  >
    Create invoice
  </button>

  <div
    role="status"
    aria-live="polite"
    data-agent-kind="status"
    data-agent-output="invoice.create.status"
  ></div>
</form>
```

---

## 6.3 Example: Dangerous Action (DOM)

```html
<button
  data-agent-kind="action"
  data-agent-action="workspace.delete"
  data-agent-scope="workspace.delete"
  data-agent-danger="high"
  data-agent-confirm="required"
>
  Delete workspace
</button>

<input
  type="text"
  aria-label="Type DELETE to confirm"
  data-agent-kind="field"
  data-agent-field="delete_confirmation_text"
  data-agent-for-action="workspace.delete"
/>
```

---

## 6.4 Capability Manifest (Typed Contract)

DOM annotations help discovery and UI interaction. For generation and validation, we also need a typed manifest.

### Manifest Location (proposal)

- `/.well-known/agent-manifest.json` (preferred)
- OR embedded: `<script type="application/agent+json">...</script>`

### Manifest Responsibilities

- Action registry with descriptions
- Page-level organization (route → actions)
- Typed input/output schemas
- Risk and confirmation metadata
- Scopes
- Versioning
- Error types
- Site-level description for LLM context
- Optional direct execution endpoints (if the site wants to expose them)

---

## 6.5 Example Agent Manifest

```json
{
  "version": "0.1",
  "site": {
    "name": "Example Billing",
    "origin": "https://billing.example.com",
    "description": "A billing application for creating and managing invoices."
  },
  "actions": {
    "invoice.create": {
      "title": "Create invoice",
      "description": "Creates a new invoice for a customer with a specified amount and currency.",
      "scope": "invoices.write",
      "risk": "low",
      "confirmation": "optional",
      "idempotent": false,
      "inputSchema": {
        "type": "object",
        "required": ["customer_email", "amount", "currency"],
        "properties": {
          "customer_email": { "type": "string", "format": "email" },
          "amount": { "type": "number", "minimum": 0 },
          "currency": { "type": "string", "enum": ["EUR", "USD"] },
          "memo": { "type": "string" }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": ["invoice_id", "status"],
        "properties": {
          "invoice_id": { "type": "string" },
          "status": { "type": "string", "enum": ["draft", "sent"] }
        }
      }
    },
    "workspace.delete": {
      "title": "Delete workspace",
      "description": "Permanently deletes the workspace. Irreversible.",
      "scope": "workspace.delete",
      "risk": "high",
      "confirmation": "required",
      "idempotent": false,
      "inputSchema": {
        "type": "object",
        "required": ["delete_confirmation_text"],
        "properties": {
          "delete_confirmation_text": { "type": "string", "const": "DELETE" }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": ["deleted"],
        "properties": {
          "deleted": { "type": "boolean" }
        }
      }
    }
  },
  "pages": {
    "/invoices/new": {
      "title": "Create Invoice",
      "actions": ["invoice.create"]
    },
    "/settings/": {
      "title": "Settings",
      "actions": ["workspace.delete"]
    }
  },
  "errors": {
    "UNAUTHORIZED": { "message": "User is not authorized for this action" },
    "VALIDATION_ERROR": { "message": "Input validation failed" },
    "CONFIRMATION_REQUIRED": { "message": "Action requires explicit confirmation" }
  }
}
```

---

## 6.6 Linter: Site Audit with `aaf-lint`

The `aaf-lint` CLI audits annotation coverage for agent accessibility. It scores how much of a page's interactive elements (forms, fields, buttons) have `data-agent-*` annotations and whether a manifest is present.

### Usage

```bash
# Single page audit
aaf-lint --audit http://localhost:5178/

# Site-wide audit (follows same-origin links on the entry page)
aaf-lint --audit http://localhost:5178/ --crawl

# With JavaScript rendering (requires playwright)
aaf-lint --audit http://localhost:5178/ --crawl --render

# Include safety checks (dangerous button annotations)
aaf-lint --audit http://localhost:5178/ --safety
```

### Flags

| Flag | Description |
|------|-------------|
| `--audit <url\|path>` | Audit a page for annotation coverage |
| `--crawl` | Follow same-origin links on the entry page (single depth, URL only) |
| `--render` | Render JavaScript with headless Chromium before auditing |
| `--safety` | Include safety checks (dangerous button annotations) |
| `--manifest <path>` | Override manifest path (otherwise auto-discovered) |

### Scoring

The default audit scores four categories:

- **FORMS** — `<form>` tags with `data-agent-action`
- **FIELDS** — `<input>`, `<select>`, `<textarea>` with `data-agent-field`
- **ACTIONS** — `<button>` tags with `data-agent-action`
- **MANIFEST** — Presence and validity of agent manifest

Categories where no elements are found (e.g. no forms on a landing page) are excluded from the score rather than counting as 100. With `--safety`, a fifth category checks that dangerous-looking buttons have `data-agent-danger` and `data-agent-confirm`.

### Auto-Manifest Discovery

When auditing a URL, the linter automatically tries to fetch `{origin}/.well-known/agent-manifest.json`. If found, it is used for the manifest score. Override with `--manifest <path>`.

### Output

With `--crawl`, the output shows a compact per-page breakdown followed by an aggregate site score:

```
=== Agent Accessibility Audit (Site) ===

  PAGE: http://localhost:5178/
    FORMS -  FIELDS -  ACTIONS 100  MANIFEST 100  → 100/100

  PAGE: http://localhost:5178/invoices/new/
    FORMS 100  FIELDS 100  ACTIONS 100  MANIFEST 100  → 100/100

  SITE OVERALL: 100/100 (2 pages) — Excellent agent accessibility
```

Categories showing `-` had no elements to check (N/A) and do not affect the score.
