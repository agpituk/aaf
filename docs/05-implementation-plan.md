# Implementation Plan

## 12. Reference Implementations (Sample Websites)

We should build a small suite of sample websites to prove the model.

### 12.1 Sample Site A: Billing App

**Use cases:** create invoice, list invoices, send invoice, delete draft invoice (high risk)

**Why:** Forms + list views + statuses + dangerous actions

### 12.2 Sample Site B: Docs App

**Use cases:** create doc, edit title/body, export PDF, publish doc (confirmation optional/required depending on policy)

**Why:** Rich text workflows and UI-heavy interactions

### 12.3 Sample Site C: Admin Dashboard

**Use cases:** create user, assign role, disable account (high risk), audit logs

**Why:** Permissions and high-risk admin actions

### 12.4 Sample Site D: Spreadsheet-lite

**Use cases:** fill cells, filter table, export CSV, create sheet

**Why:** Validates the "agent uses the site" story (table interaction, stateful UI)

---

## 13. Monorepo Structure

```text
agent-native-web/
├─ docs/
│  ├─ explainer.md
│  ├─ spec-v0.1.md
│  ├─ security.md
│  └─ examples/
├─ schemas/
│  ├─ agent-manifest.schema.json
│  └─ conformance/
├─ packages/
│  ├─ agent-runtime-core/          # semantic parser + executor abstractions
│  ├─ agent-runtime-playwright/    # Playwright implementation
│  ├─ agentgen/                    # SDK/CLI/MCP generator
│  ├─ agent-lint/                  # lint semantics in DOM and manifest
│  ├─ awi-contracts/               # planner/runtime JSON schemas + TS types
│  ├─ awi-planner-local/           # local LLM planner (Ollama)
│  ├─ awi-browser-extension/       # Chrome MV3 extension (sidebar, content script, DomAdapter)
│  ├─ awi-agent-widget/            # embeddable agent chat widget (Harbor + Ollama)
│  ├─ mcp-bridge/                  # (planned) MCP wrapper support
│  └─ devtools-extension/          # (planned) devtools panel
├─ samples/
│  ├─ billing-app/                 # reference app with AWI annotations + widget
│  ├─ docs-app/
│  ├─ admin-app/
│  └─ sheet-app/
├─ generated-examples/
│  ├─ billing-sdk-ts/
│  ├─ billing-sdk-python/
│  ├─ billing-cli/
│  └─ billing-mcp/
└─ tests/
   ├─ conformance/
   ├─ e2e/
   └─ fixtures/
```

---

## 14. Standard Drafting Plan

### 14.1 Deliverables (v0.1)

- Explainer (human-readable)
- Draft spec (normative language with MUST/SHOULD/MAY)
- Manifest JSON Schema
- Reference examples (DOM + manifest)
- Conformance tests
- Reference runtime
- Reference generator

### 14.2 Spec Sections (recommended)

1. Abstract
2. Status
3. Motivation
4. Goals and non-goals
5. Terminology
6. DOM annotation syntax and semantics
7. Manifest format
8. Security considerations
9. Privacy considerations
10. Accessibility considerations
11. Conformance
12. Examples
13. Open questions

---

## 15. Roadmap

### Phase 0: Naming and Scope (1–2 days)

- Pick project name
- Freeze v0.1 scope (small)
- Write initial explainer

**Output:** `docs/explainer.md`

### Phase 1: v0.1 Semantics + Manifest Schema (3–5 days)

- Define `data-agent-*` attributes
- Draft manifest format
- Write JSON Schema for manifest
- Write 3 examples

**Output:** `docs/spec-v0.1.md`, `schemas/agent-manifest.schema.json`

### Phase 2: Sample Site #1 — Billing (3–5 days)

- Build simple web app (React/Vue/FastAPI backend optional)
- Add `data-agent-*` labels
- Publish manifest at `/.well-known/agent-manifest.json`

**Output:** `samples/billing-app`

### Phase 3: Runtime Prototype (5–8 days)

- Build Playwright-based runtime
- Parse semantics
- Execute semantic actions
- Validate against manifest
- Add logs and confirmations

**Output:** `packages/agent-runtime-playwright`

### Phase 4: Generator Prototype (5–8 days)

- Build `agentgen`
- Generate TypeScript SDK
- Generate Python SDK
- Generate CLI
- Generate docs

**Output:** `packages/agentgen`, `generated-examples/*`

### Phase 5: MCP Bridge (optional but valuable) (3–5 days)

- Generate MCP wrapper from manifest
- Execute actions using runtime
- Return structured outputs

**Output:** `packages/mcp-bridge`

### Phase 6: Conformance and Linting (3–6 days)

- Linter for DOM semantics
- Manifest validation
- DOM/manifest mismatch checks
- CI checks

**Output:** `packages/agent-lint`, `tests/conformance`

### Phase 7: More Sample Sites and Demos (ongoing)

- Docs app
- Admin app
- Spreadsheet-lite
- Demo videos and docs
