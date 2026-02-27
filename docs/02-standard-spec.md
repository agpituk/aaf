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

Links a field or status element to an action when the element is not a DOM descendant of the action element.

Example: `data-agent-for-action="workspace.delete"`

#### `data-agent-version`

Semantics version on container/root.

Example: `0.1`

---

## 6.1.1 Element Resolution Order (Conformance)

When an agent runtime resolves a field or status element for a given action, it MUST follow this deterministic lookup order:

### Field resolution

1. **Action-scoped nested lookup** — Search for `[data-agent-kind="field"][data-agent-field="<name>"]` within the subtree of the action element (`[data-agent-kind="action"][data-agent-action="<action>"]`).
2. **Explicit `for-action` binding** — If not found in step 1, search the entire document for `[data-agent-kind="field"][data-agent-field="<name>"][data-agent-for-action="<action>"]`.
3. **Resolution failure** — If neither step produces a match, the field is not present on the page. Runtimes MUST NOT fall back to unscoped document-wide queries without `for-action`.

### Status resolution

1. **Action-scoped nested lookup** — Search for `[data-agent-kind="status"]` within the action element's subtree.
2. **Explicit `for-action` binding** — Search the document for `[data-agent-kind="status"][data-agent-for-action="<action>"]`.

### Ambiguity rules

If any resolution step matches **more than one element**, the runtime MUST either:

- **Error** — Reject the match and report a validation error to the caller, OR
- **Warn and use the first match** — Use the first element in document order but emit a diagnostic warning.

Conforming runtimes SHOULD prefer erroring in strict mode and warn-and-first-match in lenient mode. In all cases, silent selection of an arbitrary match is non-conforming.

### Rationale

Without a deterministic resolution order, two implementations could resolve the same field name to different DOM elements, causing different behavior from the same annotation. The nested-first strategy ensures that:

- Fields inside a form naturally belong to it without extra attributes.
- `data-agent-for-action` is an explicit escape hatch for fields that live outside their action's DOM subtree.
- Ambiguity is surfaced early (at lint time) rather than causing silent failures.

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

- **Action registry** — executable operations with descriptions, risk, confirmation, input/output schemas
- **Data view registry** — read-only data sources (`manifest.data`). Navigating to the page is the "execution"; agents can query the visible data. Data views with `inputSchema` are **queryable** — agents can pass filter parameters that map to URL query params.
- **Page-level organization** (route → actions + data) — enables **cross-page navigation**: the agent widget uses `pages` to discover which actions and data views exist on other routes, builds a site-aware prompt, and auto-navigates when the user requests an action or data on a different page
- Typed input/output schemas with optional **semantic type annotations** (`x-semantic`) referencing schema.org URIs
- Risk and confirmation metadata
- Scopes
- Versioning
- Error types
- Site-level description for LLM context
- Optional direct execution endpoints (if the site wants to expose them)

### Semantic Type Annotations (`x-semantic`)

Fields in `inputSchema.properties` or `outputSchema.properties` may include an optional `x-semantic` property whose value is a URI (typically a schema.org type). This lets agents understand that `customer_email` on Site A is the same concept as `customer_email` on Site B.

```json
"customer_email": {
  "type": "string",
  "format": "email",
  "x-semantic": "https://schema.org/email"
}
```

- `x-semantic` is a manifest-only convention — no changes to DOM attributes
- No validation that the URI resolves to a real type (it's a hint, not a contract)
- No `@context` resolution logic — just a plain URI string
- The planner includes semantic hints in LLM prompts (e.g. `customer_email [schema.org/email]`)
- The Vite plugin auto-infers `x-semantic` from HTML input types (`type="email"` → `schema.org/email`, `type="url"` → `schema.org/URL`, `type="date"` → `schema.org/Date`, `type="tel"` → `schema.org/telephone`)

#### Relationship with `@context`

The manifest's optional `@context` field is a JSON-LD context for consumers that process linked data. `x-semantic` is a simpler inline alternative that does not require JSON-LD processing. When both are present, `@context` should declare only namespace prefixes (e.g. `"schema": "https://schema.org/"`), while per-field semantics go in `x-semantic`. Do not duplicate the same mapping in both places.

### Queryable Data Views

Data views may include an optional `inputSchema` (same shape as action `inputSchema`). When present, agents can pass query parameters that the runtime translates to URL search params when navigating to the data view's page.

```json
"invoice.list": {
  "title": "List invoices",
  "scope": "invoices.read",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["draft", "sent", "paid"] },
      "min_amount": { "type": "number" }
    }
  },
  "outputSchema": { ... }
}
```

Flow: User says "show me paid invoices" → LLM returns `{"action": "invoice.list", "args": {"status": "paid"}}` → runtime navigates to `/invoices/?status=paid` → page loads pre-filtered → widget scrapes and presents results.

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
          "customer_email": { "type": "string", "format": "email", "x-semantic": "https://schema.org/email" },
          "amount": { "type": "number", "minimum": 0, "x-semantic": "https://schema.org/price" },
          "currency": { "type": "string", "enum": ["EUR", "USD"], "x-semantic": "https://schema.org/priceCurrency" },
          "memo": { "type": "string", "x-semantic": "https://schema.org/description" }
        }
      },
      "outputSchema": {
        "type": "object",
        "required": ["invoice_id", "status"],
        "properties": {
          "invoice_id": { "type": "string", "x-semantic": "https://schema.org/identifier" },
          "status": { "type": "string", "enum": ["draft", "sent"], "x-semantic": "https://schema.org/orderStatus" }
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
  "data": {
    "invoice.list": {
      "title": "List invoices",
      "description": "All invoices with customer, amount, currency, and status.",
      "scope": "invoices.read",
      "inputSchema": {
        "type": "object",
        "properties": {
          "status": { "type": "string", "enum": ["draft", "sent", "paid"], "x-semantic": "https://schema.org/orderStatus" },
          "min_amount": { "type": "number", "x-semantic": "https://schema.org/price" }
        }
      },
      "outputSchema": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "customer_email": { "type": "string" },
            "amount": { "type": "number" },
            "currency": { "type": "string" },
            "status": { "type": "string" }
          }
        }
      }
    }
  },
  "pages": {
    "/invoices/new": {
      "title": "Create Invoice",
      "actions": ["invoice.create"]
    },
    "/invoices/": {
      "title": "Invoice List",
      "description": "Table listing all invoices with their status.",
      "data": ["invoice.list"]
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

## 6.6 Planner Response Types

A planner returns one of three response kinds to the runtime:

| Kind | JSON shape | Meaning |
|------|-----------|---------|
| **action** | `{ "action": "invoice.create", "args": { ... } }` | Execute an action with the given arguments |
| **navigate** | `{ "navigate": "/settings/" }` | Navigate to a page (no action to execute on arrival) |
| **answer** | `{ "action": "none", "answer": "..." }` | Direct answer from page data — no action or navigation needed |

### Navigation semantics

When the runtime receives an `action` response for an action on another page, it navigates there and **re-plans** on arrival (the action still needs to be executed). When it receives a `navigate` response, it navigates and **stops** — the navigation itself was the user's goal.

This distinction prevents infinite loops: without it, a request like "go to the settings page" would navigate to `/settings/`, re-plan, fail to map the request to an action, and loop.

The canonical TypeScript type is `PlannerResult` in `@agent-accessibility-framework/contracts`.

### Implementation note: LLM response normalization

The canonical formats above are what the spec defines. In practice, LLMs frequently produce variations — especially for `navigate`:

- `{ "action": "navigate", "args": { "page": "/settings/" } }` instead of `{ "navigate": "/settings/" }`
- Relative paths (`"invoices/new"`) instead of absolute (`"/invoices/new"`)
- Full URLs (`"http://localhost:5173/settings/"`) instead of pathnames

Planner implementations SHOULD normalize these gracefully rather than rejecting them. The reference parser in `aaf-planner-local` handles all of the above by extracting the pathname and prepending `/` when needed.

---

## 6.7 Linter: Site Audit with `aaf-lint`

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
