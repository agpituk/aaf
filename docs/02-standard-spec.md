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
