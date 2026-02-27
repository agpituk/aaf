# Future and Appendices

## 12. Open Questions

These are expected and healthy.

- **How should multi-step workflows be modeled?**
  - `checkout.step1`, `checkout.step2`?
  - Workflow graph in manifest?
  - *Partially addressed*: cross-page navigation in the widget (v0.1) allows the agent to plan and execute actions across pages using the manifest's `pages` map, with conversation persistence via sessionStorage.
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

## 13. Standardization Strategy (After MVP)

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

## 14. Completed Bootstrap (v0.1)

All initial bootstrap steps have been completed:

- ~~Create the repo~~ — done
- ~~README, spec docs, JSON Schema~~ — done
- ~~Sample billing app with `data-agent-*` annotations and manifest~~ — done
- ~~Runtime action (`invoice.create`) in Playwright~~ — done
- ~~Generated TS client from manifest~~ — done (`agentgen`)
- ~~Visual inspector~~ — done (widget inspector mode)
- ~~Embeddable agent widget~~ — done (`aaf-agent-widget` with Ollama)
- ~~React and Vue bindings~~ — done (`aaf-react`, `aaf-vue`)
- ~~ESLint plugin~~ — done (`aaf-eslint-plugin`)
- ~~Vite plugin~~ — done (`aaf-vite-plugin`)
- ~~Site-wide linter/auditor~~ — done (`aaf-lint` with `--crawl`)
- ~~Cross-page navigation in widget~~ — done (manifest-driven site-aware planning, sessionStorage conversation persistence, loop guard)
- ~~Semantic type annotations (`x-semantic`)~~ — done (optional schema.org URIs on manifest field properties, surfaced in LLM prompts)
- ~~Queryable data views~~ — done (optional `inputSchema` on data views, query params → URL search params, filtered page rendering)

---

## 15. Next Goals

- Conformance badge for websites ("Agent Semantics v0.1")
- GitHub Action / CI to lint semantics on PRs
- Codegen templates for Python SDK and MCP wrapper
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
