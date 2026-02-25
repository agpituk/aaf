# Tooling and Generation

## 7. SDK and CLI Generation Model

### 7.1 Why Auto-Generation Matters

If each site ships agent semantics manually, adoption will be slow.

We want this flow:

```bash
agentgen https://billing.example.com
```

Output:

- `billing-agent-sdk` (TypeScript)
- `billing-agent-sdk` (Python)
- `billing-agent-cli`
- Optional `billing-agent-mcp`
- `docs/examples`
- Conformance report

This is similar to OpenAPI client generation, but with UI-aware semantics.

### 7.2 Generated SDK Modes

Generated SDKs should support two execution modes.

#### A. Direct Mode (if site supports a direct action endpoint)

Fast and deterministic.

```python
from billing_agent_sdk import BillingClient

client = BillingClient(auth_token="...")
invoice = client.actions.invoice_create(
    customer_email="alice@example.com",
    amount=120.0,
    currency="EUR",
    memo="Consulting"
)
print(invoice.invoice_id)
```

#### B. UI Mode (browser automation using semantics)

Uses the actual website UI.

```python
from billing_agent_sdk import BillingBrowserClient

client = BillingBrowserClient(session="chrome-profile-default")
client.ui.invoice_create.open()
client.ui.invoice_create.fill(
    customer_email="alice@example.com",
    amount=120.0,
    currency="EUR",
    memo="Consulting"
)
client.ui.invoice_create.submit()
status = client.ui.invoice_create.read_status()
print(status)
```

#### Why Both Matter

- **Direct mode** is great for reliability and speed
- **UI mode** is needed for real workflows, previews, modals, and page-specific logic

### 7.3 Generated CLI Examples

```bash
# Discover
billing-agent actions list

# Validate without executing
billing-agent invoice.create \
  --customer-email alice@example.com \
  --amount 120 \
  --currency EUR \
  --memo "Consulting" \
  --dry-run

# Execute via UI mode
billing-agent invoice.create \
  --customer-email alice@example.com \
  --amount 120 \
  --currency EUR \
  --ui

# Dangerous action requires explicit confirmation
billing-agent workspace.delete --confirm "DELETE"
```

---

## 8. Automation Runtime Design

We want agents to interact with websites, not just backend tools. So we build a browser automation runtime that understands `data-agent-*`.

### 8.1 Runtime Responsibilities

- Discover agent actions on page
- Map logical fields to elements
- Read statuses/results
- Enforce risk and confirmation checks
- Validate inputs against manifest
- Execute interactions through browser automation (Playwright/Puppeteer)
- Emit audit logs

### 8.2 Runtime Stack (suggested)

| Component | Role |
|-----------|------|
| **Browser driver** | Playwright (first implementation) |
| **Semantic parser** | Reads `data-agent-*` |
| **Manifest validator** | Validates action inputs/outputs |
| **Policy engine** | Confirmation and risk checks |
| **Action executor** | Field fill, click, dialog handling |
| **Recorder** | Logs semantic steps (not just CSS selectors) |

### 8.3 Semantic Execution Log Example

```json
{
  "session_id": "s_123",
  "action": "invoice.create",
  "mode": "ui",
  "steps": [
    { "type": "navigate", "url": "/invoices/new" },
    { "type": "fill", "field": "customer_email", "value": "alice@example.com" },
    { "type": "fill", "field": "amount", "value": 120.0 },
    { "type": "fill", "field": "currency", "value": "EUR" },
    { "type": "click", "action": "invoice.create.submit" },
    { "type": "read_status", "output": "invoice.create.status", "value": "Invoice created" }
  ]
}
```

This is much easier to debug than raw DOM click traces.

---

## 8.4 Agent Widget (Embeddable Runtime)

The **agent widget** (`packages/awi-agent-widget`) is a single bundled script that adds a chat-driven agent panel to any AWI-annotated page. It demonstrates the full execution flow without requiring a browser extension.

### Architecture

```
<script src="/awi-agent.js">
  ├── SemanticParser (discover actions on page)
  ├── HarborPlanner (LLM inference via window.ai or Ollama)
  │   ├── PromptBuilder (reused from awi-planner-local)
  │   └── ResponseParser (reused from awi-planner-local)
  ├── ManifestValidator + PolicyEngine (validate + enforce)
  ├── DOM Executor (fill fields, click submit, read status)
  ├── Chat UI (shadow DOM, floating panel)
  └── Confirmation dialog (high-risk actions)
```

### Harbor Integration

[Harbor](https://github.com/nichochar/harbor) is a Firefox browser infrastructure layer that provides `window.ai` (LLM access) and `window.agent` (tools, permissions) to web pages.

The widget's `HarborPlanner` uses Harbor as its primary LLM backend:

1. Check for `window.ai` availability
2. If present: `window.ai.createTextSession({ systemPrompt })` → `session.prompt(userPrompt)`
3. If absent: fall back to direct Ollama fetch (`localhost:11434/api/generate`)
4. If neither: show inspector-only mode (discovered actions, no planning)

This means the widget works in three tiers:
- **Harbor + Firefox**: best experience, local LLM via browser infrastructure
- **Any browser + Ollama**: works anywhere Ollama is running locally
- **No LLM**: graceful degradation to action/field inspector

### Shadow DOM Isolation

The widget renders inside a shadow DOM (`#awi-agent-root`) to prevent style leaks in both directions. All CSS is injected as a `<style>` element inside the shadow root.

### Usage

```html
<!-- Add to any AWI-annotated page -->
<script type="module" src="/awi-agent.js"></script>
```

The widget auto-initializes when the DOM is ready. It bails silently if no `data-agent-kind` elements are found on the page.

---

## 9. Relationship with MCP

MCP is **not** the same thing as this proposal.

### MCP Solves

- Tool protocol
- Typed tool execution
- Structured tool inputs/outputs

### This Proposal Solves

- Agent-readable website interaction semantics
- Browser/UI interaction reliability

They are **complementary**.

### 9.1 Optional MCP Wrapper (generated)

We can generate an MCP server that exposes site actions as tools, while executing via UI semantics under the hood.

**Flow:**

1. LLM calls MCP tool `invoice.create`
2. MCP wrapper validates input
3. Wrapper uses browser runtime + `data-agent-*` semantics
4. Website UI is operated safely
5. Result returned as structured output

**This gives:**

- MCP compatibility for agent ecosystems
- Actual website UI interaction for sites and workflows
