# Future and Appendices

## 19. Open Questions

These are expected and healthy.

- **How should multi-step workflows be modeled?**
  - `checkout.step1`, `checkout.step2`?
  - Workflow graph in manifest?
- **Should result extraction be explicit in DOM?**
  - `data-agent-result-field="invoice_id"` on status/result nodes?
- **How should localization work?**
  - Semantics should remain stable while labels change
- **Should the manifest support direct execution endpoints?**
  - Optional `execute` section for hybrid mode
- **How do we expose capability differences by role/user?**
  - Dynamic manifest per user session?
  - Role-filtered manifest?
- **How should rich editors be modeled?**
  - Content blocks?
  - Editor commands?
- **Should there be a browser devtools panel for inspecting semantics?**
  - Done: browser extension inspector tab + agent widget inspector-only mode

---

## 20. Standardization Strategy (After MVP)

Do not start by asking for browser changes. Start by proving value.

### Step 1: De Facto Standard

- Open source spec + reference implementation
- Sample apps
- Generator + runtime
- Demos

### Step 2: Community Feedback

- Browser automation folks
- Framework authors
- Accessibility experts (to avoid collisions)
- Tooling vendors and agent platform teams

### Step 3: Incubation Path

- Publish explainer
- Community group / standards discussion
- Refine based on implementation experience

At this stage we can discuss:

- Standard attribute names beyond `data-*`
- Browser APIs for semantic querying
- Devtools support

---

## 21. Immediate Next Actions

### 21.1 Create the Repo

- `agent-native-web`

### 21.2 Write These First Files

- `README.md`
- `docs/explainer.md`
- `docs/spec-v0.1.md`
- `schemas/agent-manifest.schema.json`

### 21.3 Build One Sample Site

- `samples/billing-app`
- Add `data-agent-*` labels
- Expose manifest

### 21.4 Build One Runtime Action

- `invoice.create` in Playwright
- Semantic parser only, no generic engine yet

### 21.5 Build One Generated Client

- TS or Python first
- CLI can be thin wrapper over generated client

---

## 22. Stretch Goals

Once MVP works, we can go bigger.

- ~~Visual inspector for `data-agent-*`~~ (done: widget inspector mode)
- ~~Embeddable agent widget for any AAF page~~ (done: `awi-agent-widget` with Ollama)
- Conformance badge for websites ("Agent Semantics v0.1")
- GitHub Action to lint semantics on PRs
- Framework plugins:
  - React helper components
  - Vue directives
- Codegen templates for:
  - SDK TS/Python
  - CLI
  - MCP wrapper
- Action replay tools using semantic logs
- "Teach the agent" mode for annotating legacy websites
- Scoped model access permissions for trusted agent runtimes

---

## Appendix A: Proposed v0.1 Attribute Summary

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-agent-kind` | Semantic role | `action` |
| `data-agent-action` | Action identifier | `invoice.create` |
| `data-agent-field` | Field identifier | `customer_email` |
| `data-agent-danger` | Risk level | `high` |
| `data-agent-confirm` | Confirmation policy | `required` |
| `data-agent-scope` | Permission hint | `invoices.write` |
| `data-agent-idempotent` | Retry safety | `false` |
| `data-agent-output` | Output/status hint | `invoice.create.status` |
| `data-agent-for-action` | Cross-link field to action | `workspace.delete` |
| `data-agent-version` | Semantics version | `0.1` |

---

## Appendix B: Build It

This is intentionally ambitious.

The key is to keep v0.1 small, prove it on one real sample app, and then expand.

If we can make one website feel dramatically better for agents using:

- Semantic DOM labels
- A typed manifest
- A generator
- A runtime

...then this stops being just a spec idea and becomes a real movement.
