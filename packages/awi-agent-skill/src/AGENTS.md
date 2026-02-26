# AAF Annotation Guide for Coding Agents

You are adding Agent Accessibility Framework (AAF) annotations to HTML. These `data-agent-*` attributes make websites machine-readable by AI agents without CSS selectors.

## Core Rule

Agents interact through **semantic names**, never CSS selectors. Every interactive element gets a `data-agent-*` identity.

## Attributes Reference

### Actions (`data-agent-kind="action"`)
Wrap any executable operation (forms, buttons, dialogs).

```html
<form data-agent-kind="action"
      data-agent-action="invoice.create"
      data-agent-scope="invoices.write"
      data-agent-danger="low"
      data-agent-confirm="optional"
      data-agent-idempotent="false">
```

- `action`: dot-notation — `service.verb` (e.g. `invoice.create`, `user.delete`)
- `scope`: permission scope — `resource.operation` (e.g. `invoices.write`)
- `danger`: `"none"` | `"low"` | `"high"`
- `confirm`: `"never"` | `"optional"` | `"required"`
- `idempotent`: `"true"` | `"false"`

**Rule**: `danger="high"` MUST pair with `confirm="required"`.

### Fields (`data-agent-kind="field"`)
Mark inputs, selects, textareas.

```html
<input data-agent-kind="field"
       data-agent-field="customer_email"
       type="email" />
```

- `field`: snake_case identifier
- Must be nested inside an action element OR have `data-agent-for-action`

```html
<!-- Field outside its action -->
<input data-agent-kind="field"
       data-agent-field="search_query"
       data-agent-for-action="search.execute" />
```

### Sub-actions (Submit buttons)
```html
<button data-agent-kind="action"
        data-agent-action="invoice.create.submit"
        type="submit">
  Create Invoice
</button>
```

Sub-actions add an extra dot segment: `parent_action.submit`.

### Status elements
```html
<div data-agent-kind="status"
     data-agent-output="invoice.create.status"
     role="status"
     aria-live="polite">
</div>
```

### Collections & Items
```html
<div data-agent-kind="collection" data-agent-action="invoice.list">
  <div data-agent-kind="item" data-agent-output="invoice">...</div>
</div>
```

## Naming Conventions

| Type | Convention | Examples |
|------|-----------|----------|
| Actions | `service.verb` | `invoice.create`, `user.delete`, `search.execute` |
| Fields | `snake_case` | `customer_email`, `billing_address`, `start_date` |
| Scopes | `resource.permission` | `invoices.write`, `users.admin` |
| Outputs | `action.status` | `invoice.create.status`, `user.delete.result` |

## Step-by-Step Annotation Process

1. **Identify actions**: Find forms, buttons, dialogs that perform operations
2. **Name the action**: Use `service.verb` dot notation
3. **Set risk level**: `none` for reads, `low` for creates, `high` for deletes
4. **Set confirmation**: `required` for `danger="high"`, `optional` for `low`, `never` for `none`
5. **Mark fields**: Add `data-agent-field` to all inputs inside the action
6. **Add submit**: Mark the submit button as a sub-action
7. **Add status**: Mark any status/result display elements

## Example Transformation

### Before (plain HTML):
```html
<form id="new-invoice" class="form-container">
  <input type="email" name="email" placeholder="Customer email" required />
  <input type="number" name="amount" placeholder="Amount" min="0" required />
  <select name="currency">
    <option value="USD">USD</option>
    <option value="EUR">EUR</option>
  </select>
  <textarea name="memo" placeholder="Memo"></textarea>
  <button type="submit">Create Invoice</button>
  <div id="status" class="status-message"></div>
</form>
```

### After (AAF-annotated):
```html
<form id="new-invoice" class="form-container"
      data-agent-kind="action"
      data-agent-action="invoice.create"
      data-agent-scope="invoices.write"
      data-agent-danger="low"
      data-agent-confirm="optional"
      data-agent-idempotent="false">
  <input type="email" name="email" placeholder="Customer email" required
         data-agent-kind="field"
         data-agent-field="customer_email" />
  <input type="number" name="amount" placeholder="Amount" min="0" required
         data-agent-kind="field"
         data-agent-field="amount" />
  <select name="currency"
          data-agent-kind="field"
          data-agent-field="currency">
    <option value="USD">USD</option>
    <option value="EUR">EUR</option>
  </select>
  <textarea name="memo" placeholder="Memo"
            data-agent-kind="field"
            data-agent-field="memo"></textarea>
  <button type="submit"
          data-agent-kind="action"
          data-agent-action="invoice.create.submit">
    Create Invoice
  </button>
  <div id="status" class="status-message"
       data-agent-kind="status"
       data-agent-output="invoice.create.status"
       role="status"
       aria-live="polite"></div>
</form>
```

## Manifest Generation

After annotating HTML, generate `/.well-known/agent-manifest.json`:

```json
{
  "version": "0.1",
  "site": {
    "name": "Your App Name",
    "origin": "https://yourapp.com"
  },
  "actions": {
    "invoice.create": {
      "title": "Create invoice",
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
        "properties": {}
      }
    }
  }
}
```

## Rules to Follow

1. **Never use CSS selectors** in agent contracts — semantic names only
2. **danger="high" requires confirm="required"** — always pair them
3. **Fields must be linked** — nested in action or use `data-agent-for-action`
4. **Action names are dot-notation** — `service.verb`, NOT `createInvoice` or `create-invoice`
5. **Field names are snake_case** — `customer_email`, NOT `customerEmail` or `customer-email`
6. **Existing HTML stays unchanged** — only ADD `data-agent-*` attributes, never remove classes/IDs
7. **Add role="status" and aria-live="polite"** to status elements for accessibility
8. **Version attribute on root** — `<html data-agent-version="0.1">`
