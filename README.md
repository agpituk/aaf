# Agent-Native Web (AWI)

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

## What's in the repo

I built out a full prototype to test whether this idea actually works:

```
packages/
  agent-runtime-core/             Core: SemanticParser, ManifestValidator, PolicyEngine, ExecutionLogger
  agent-runtime-playwright/       Playwright runtime (AWIAdapter for headless testing)
  agent-lint/                     HTML + manifest conformance linter
  agentgen/                       SDK + CLI code generator from manifests
  awi-contracts/                  Typed planner <-> runtime contracts with selector rejection
  awi-planner-local/              Local LLM planner (Ollama integration)
  awi-browser-extension-firefox/  Firefox extension with Harbor LLM integration
  awi-agent-widget/               Embeddable agent chat widget (Harbor + Ollama, shadow DOM)
  awi-agent-skill/                Agent skill definitions
  awi-react/                      React bindings for AWI annotations
  awi-vue/                        Vue bindings for AWI annotations
  awi-eslint-plugin/              ESLint plugin for AWI attribute validation
  awi-vite-plugin/                Vite plugin for manifest injection
  awi-cli/                        CLI for scaffolding and validation
samples/
  billing-app/                    Reference app with AWI annotations + agent widget
  docs-site/                      Interactive docs site (data chat mode — you can ask it questions)
schemas/
  agent-manifest.schema.json      JSON Schema for manifest validation
tests/
  conformance/                    Conformance test fixtures
  falsification/                  Selector vs semantic reliability benchmark
docs/                             Proposal documents
```

## Quick start

```bash
# Install dependencies
npm install

# Run the full test suite (243 tests)
npm test

# Start the sample billing app
cd samples/billing-app && npx vite
# Open http://localhost:5173
```

### Run specific test suites

```bash
# Unit tests for a specific package
npx vitest run packages/agent-runtime-core
npx vitest run packages/awi-contracts
npx vitest run packages/awi-planner-local
npx vitest run packages/awi-browser-extension-firefox
npx vitest run packages/awi-agent-widget

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

### Lint a page

```bash
npx agent-lint --html samples/billing-app/invoices/new/index.html \
               --manifest samples/billing-app/public/.well-known/agent-manifest.json
```

### Generate an SDK from a manifest

```bash
npx agentgen --manifest samples/billing-app/public/.well-known/agent-manifest.json \
             --output generated-sdk/
```

### Load the Firefox extension

1. Run `cd packages/awi-browser-extension-firefox && npx vite build`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on" and select `packages/awi-browser-extension-firefox/dist/manifest.json`
4. Start the billing app (`cd samples/billing-app && npx vite`)
5. Navigate to `http://localhost:5173/invoices/new`
6. Open the AWI sidebar panel and use the Inspector tab to see discovered actions
7. (Optional) Install [Ollama](https://ollama.com) and pull a model (`ollama pull llama3.2`) to enable the Chat tab
8. (Optional) Install [Harbor](https://github.com/nichochar/harbor) for native Firefox LLM access via `window.ai`

### Try the agent widget

The agent widget is an embeddable `<script>` tag that adds a floating chat panel to any AWI-annotated page. It uses [Harbor](https://github.com/nichochar/harbor) (`window.ai`) for LLM inference in Firefox, with automatic fallback to local Ollama. No extension required.

```html
<!-- Add to any AWI-annotated page -->
<script type="module" src="/awi-agent.js"></script>
```

The billing app already includes the widget. To try it:

1. Start the billing app: `cd samples/billing-app && npx vite`
2. Open `http://localhost:5173/invoices/new`
3. Click the chat bubble (bottom-right corner)
4. Type: "Create an invoice for alice@example.com for 120 EUR"

The widget auto-detects the LLM backend:
- **Harbor installed** (Firefox): uses `window.ai.createTextSession()` for local LLM access
- **Ollama running**: falls back to direct `localhost:11434` API calls
- **No LLM**: shows inspector-only mode (lists discovered actions and fields)

The widget runs entirely in a shadow DOM — no style leaks, no conflicts with the host page.

## The falsification benchmark

This is the test I find most convincing. **Semantic automation survives UI refactors that break selector-based automation.**

`tests/falsification/` contains two copies of the billing app HTML — the original and a refactored version with completely different CSS classes, IDs, and layout, but identical `data-agent-*` attributes.

```bash
npx vitest run tests/falsification
```

| Approach | Original app | Refactored app | Survives refactor? |
|----------|-------------|----------------|-------------------|
| CSS selectors | 4/4 pass | 0/4 pass | No |
| AWI semantic | 2/2 pass | 2/2 pass | **Yes** |

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
| `data-agent-confirm` | `never` `optional` `required` | Confirmation policy |
| `data-agent-scope` | `invoices.write` | Permission hint |
| `data-agent-idempotent` | `true` `false` | Safe to retry? |
| `data-agent-for-action` | `workspace.delete` | Links a field to an action outside its DOM tree |

## Safety model

Actions declare risk and confirmation requirements. The runtime enforces them — the LLM cannot bypass this:

- `danger="high"` + `confirm="required"` blocks execution unless the user explicitly confirms
- The runtime returns `needs_confirmation` with metadata (action name, risk, scope)
- The extension shows a confirmation dialog; only on user approval does it re-execute with `confirmed: true`

## Execution flow

```
User message
  -> Discover actions on page (SemanticParser)
  -> LLM plans: { action: "invoice.create", args: { ... } }
  -> Validate args against manifest schema (ManifestValidator)
  -> Check policy: risk, confirmation, required fields (PolicyEngine)
  -> Execute: fill fields, click submit, read status (AWIAdapter)
  -> Return structured result + semantic log
```

## Documentation

See [`docs/`](docs/) for the full proposal:

| Document | Topic |
|----------|-------|
| [01 - Vision and Goals](docs/01-vision-and-goals.md) | The problem and why this approach |
| [02 - Standard Spec](docs/02-standard-spec.md) | Proposed DOM attributes and manifest format |
| [03 - Tooling](docs/03-tooling.md) | SDK generation, runtimes, MCP |
| [04 - Security](docs/04-security-and-conformance.md) | Safety rules and conformance |
| [05 - Implementation](docs/05-implementation-plan.md) | Build phases |
| [06 - Design Principles](docs/06-design-principles.md) | Scope and principles |
| [07 - Future](docs/07-future-and-appendices.md) | Open questions and future directions |

## Status

This is a working prototype — 243 passing tests across 29 test suites. I built it to prove (or disprove) the idea, not to ship a production framework. The prototype includes:

- Core runtime (parser, validator, policy engine, logger, arg coercion)
- Firefox extension with Harbor LLM integration (sidebar chat, inspector, DomAdapter)
- Agent widget — embeddable `<script>` for any AWI page with Harbor/Ollama LLM
- Local planner (Ollama), Harbor planner (`window.ai`), prompt builder, response parser
- Linter, code generator, falsification benchmark
- Typed planner/runtime contracts with selector rejection
- React and Vue bindings, ESLint plugin, Vite plugin
- Interactive docs site (data chat mode — you can ask it questions about AWI)

The widget demonstrates the full loop — chat, plan, validate, execute, confirm — running directly on any annotated page. On pages with only data collections (no actions), it enters **data chat mode** where you can ask questions about the visible content.

I think the interesting question now is whether this pattern works on real product flows, not just sample apps. If you try it and have thoughts, I'd love to hear them.
