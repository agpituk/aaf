# Agent Accessibility Framework (AAF)

**A proposal for making websites reliably operable by browser agents.**

I've been watching LLM agents try to interact with websites, and the current approach is broken. They guess CSS selectors, rely on visual layout, and break the moment a UI redesign ships. It's fundamentally fragile because the web was never designed with software agents in mind.

This repo is my attempt at a solution: a thin semantic layer (`data-agent-*` attributes) and a typed capability manifest that can be added to existing HTML. The idea is that a runtime can discover actions, validate inputs, enforce safety rules, and execute through the real UI — without selectors, without screen scraping, without breaking when a class name changes.

The human UI stays the same. It just becomes agent-readable.

## The idea

A regular HTML form becomes agent-operable by adding semantic attributes:

```html
<form data-agent-kind="action"
      data-agent-action="invoice.create"
      data-agent-danger="low"
      data-agent-confirm="optional">

  <input type="email"
         data-agent-kind="field"
         data-agent-field="customer_email" />

  <input type="number"
         data-agent-kind="field"
         data-agent-field="amount" />

  <button type="submit"
          data-agent-kind="action"
          data-agent-action="invoice.create.submit">
    Create Invoice
  </button>

  <div data-agent-kind="status"
       data-agent-output="invoice.create.status"></div>
</form>
```

A manifest at `/.well-known/agent-manifest.json` declares action schemas, risk levels, and confirmation policies. A runtime uses both to:

1. **Discover** available actions and fields on the page
2. **Validate** inputs against JSON Schema
3. **Enforce** safety policies (block high-risk actions without confirmation)
4. **Execute** by filling fields and clicking submit through the real DOM
5. **Log** every step semantically (not selector-based)

The key design boundary: **the LLM chooses intent; the runtime enforces execution.** The model never drives the mouse — it picks an action name and args, and the runtime validates and executes safely.

## Why not just use tool APIs?

Tool protocols (MCP, etc.) are great when a clean backend action exists. This proposal targets the cases where the agent needs to use the actual UI:

- Forms with live validation, modals, previews
- Draft vs. publish flows, in-page state
- Sites without a tool surface
- "Do it like the user would"

This approach and tool protocols are complementary — the manifest could generate MCP tool definitions later.

## Try the billing app

The fastest way to see this in action is the sample billing app with its embedded agent chat widget.

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- [Ollama](https://ollama.com) installed and running

### Steps

```bash
# 1. Pull an LLM model
ollama pull llama3.2

# 2. Make sure Ollama is running (it usually starts automatically)
ollama serve   # if not already running

# 3. Install dependencies
npm install

# 4. Start the billing app
cd samples/billing-app && npx vite
```

Open `http://localhost:5173/invoices/new` and click the chat bubble in the bottom-right corner.

### Example prompts to try

| Prompt | What happens |
|--------|-------------|
| "Create an invoice for alice@example.com for 120 EUR" | Fills the form but does not submit (review mode) — user clicks submit |
| "Send a bill to bob@test.com for 50 USD" | Plans and executes `invoice.create` |
| "Delete the workspace" (on `/settings/`) | Triggers high-risk confirmation dialog |

On the invoices list page (`/invoices/`), the widget enters **data chat mode** — you can ask questions about the visible invoices like "How many invoices are there?" or "What's the total amount?"

### Try the docs site

There's also an interactive documentation site that is itself AAF-annotated — you can ask the chat widget questions about the spec:

```bash
cd samples/docs-site && npm run dev
# Open http://localhost:5174
```

The docs site covers attributes, manifests, execution flow, tooling, and examples. Since every page is annotated with `data-agent-*` attributes, the widget enters data chat mode and you can ask it things like "What attributes does AAF define?" or "How does execution work?"

## What's in the repo

The prototype includes a core runtime (parser, validator, policy engine, logger), a Playwright testing adapter, a conformance linter, a code generator, typed planner/runtime contracts, a local LLM planner (Ollama), an embeddable agent chat widget, framework bindings (React, Vue), and supporting tooling (ESLint plugin, Vite plugin, CLI). See [`CLAUDE.md`](CLAUDE.md) for the full monorepo layout.

## Quick start

```bash
# Install dependencies
npm install

# Run the full test suite
npm test

# Start the sample billing app
cd samples/billing-app && npx vite
# Open http://localhost:5173
```

### Run specific test suites

```bash
# Unit tests for a specific package
npx vitest run packages/agent-runtime-core
npx vitest run packages/aaf-contracts
npx vitest run packages/aaf-planner-local
npx vitest run packages/aaf-agent-widget

# Falsification benchmark (selector vs semantic reliability)
npx vitest run tests/falsification

# Generate reliability report
npm run benchmark
# Outputs: artifacts/reliability-report.md
```

### E2E tests (Playwright)

```bash
# Start the billing app, then run Playwright tests
cd packages/agent-runtime-playwright
npm run test:e2e
```

### Lint / audit a page

```bash
# Local file
npx aaf-lint --html samples/billing-app/invoices/new/index.html \
             --manifest samples/billing-app/public/.well-known/agent-manifest.json

# Remote URL (raw fetch)
npx aaf-lint --audit https://example.com

# Remote SPA (renders JavaScript in headless Chromium first, requires playwright)
npx aaf-lint --audit https://example.com --render

# Site-wide audit — follows same-origin links on the entry page
npx aaf-lint --audit https://example.com --render --crawl

# Include safety checks (dangerous button annotations)
npx aaf-lint --audit https://example.com --render --safety
```

The audit auto-discovers a manifest at `{origin}/.well-known/agent-manifest.json` — no need to pass `--manifest` for sites that serve one.

### Generate an SDK from a manifest

```bash
npx agentgen --manifest samples/billing-app/public/.well-known/agent-manifest.json \
             --output generated-sdk/
```

## The falsification benchmark

This is the test I find most convincing. **Semantic automation survives UI refactors that break selector-based automation.**

`tests/falsification/` contains two copies of the billing app HTML — the original and a refactored version with completely different CSS classes, IDs, and layout, but identical `data-agent-*` attributes.

```bash
npx vitest run tests/falsification
```

| Approach | Original app | Refactored app | Survives refactor? |
|----------|-------------|----------------|-------------------|
| CSS selectors | 4/4 pass | 0/4 pass | No |
| AAF semantic | 2/2 pass | 2/2 pass | **Yes** |

The benchmark also tests:
- **Safety**: high-risk actions without confirmation are blocked
- **Drift detection**: linter catches broken `data-agent-*` attributes
- **Missing fields**: required field omission produces clear errors

## Proposed attributes

| Attribute | Values | Purpose |
|-----------|--------|---------|
| `data-agent-kind` | `action` `field` `status` `collection` `item` `dialog` `step` | Semantic role |
| `data-agent-action` | `invoice.create` | Action identifier (dot-notation) |
| `data-agent-field` | `customer_email` | Field identifier (snake_case) |
| `data-agent-danger` | `none` `low` `high` | Risk level |
| `data-agent-confirm` | `never` `optional` `review` `required` | Confirmation policy |
| `data-agent-scope` | `invoices.write` | Permission hint |
| `data-agent-idempotent` | `true` `false` | Safe to retry? |
| `data-agent-for-action` | `workspace.delete` | Links a field to an action outside its DOM tree |

## Safety model

Actions declare risk and confirmation requirements. The runtime enforces them — the LLM cannot bypass this:

- `danger="high"` + `confirm="required"` blocks execution unless the user explicitly confirms
- The runtime returns `needs_confirmation` with metadata (action name, risk, scope)
- The widget shows a confirmation dialog; only on user approval does it re-execute with `confirmed: true`

## Execution flow

```
User message
  -> Discover actions on page (SemanticParser)
  -> LLM plans: { action: "invoice.create", args: { ... } }
  -> Validate args against manifest schema (ManifestValidator)
  -> Check policy: risk, confirmation, required fields (PolicyEngine)
  -> Execute: fill fields, click submit, read status (AAFAdapter)
  -> Return structured result + semantic log
```

## Documentation

See [`docs/`](docs/) for the full proposal:

| Document | Topic |
|----------|-------|
| [01 - Vision and Goals](docs/01-vision-and-goals.md) | The problem and why this approach |
| [02 - Standard Spec](docs/02-standard-spec.md) | Proposed DOM attributes and manifest format |
| [04 - Security](docs/04-security-and-conformance.md) | Safety rules and conformance |
| [06 - Design Principles](docs/06-design-principles.md) | Scope and principles |
| [07 - Future](docs/07-future-and-appendices.md) | Open questions and future directions |

## Status

This is a working prototype — I built it to prove (or disprove) the idea, not to ship a production framework. The prototype includes:

- Core runtime (parser, validator, policy engine, logger, arg coercion)
- Agent widget — embeddable `<script>` for any AAF page with Ollama LLM
- Local planner (Ollama), prompt builder, response parser
- Linter, code generator, falsification benchmark
- Typed planner/runtime contracts with selector rejection
- React and Vue bindings, ESLint plugin, Vite plugin
- Interactive docs site (data chat mode — you can ask it questions about AAF)

The widget demonstrates the full loop — chat, plan, validate, execute, confirm — running directly on any annotated page. On pages with only data collections (no actions), it enters **data chat mode** where you can ask questions about the visible content.

I think the interesting question now is whether this pattern works on real product flows, not just sample apps. If you try it and have thoughts, I'd love to hear them.
