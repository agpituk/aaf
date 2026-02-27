# Security, Privacy, and Conformance

> This section is mandatory if we want this to be taken seriously.

---

## 7. Security and Privacy Principles

### 7.1 Security Rules

- **Semantics are never authorization** — server-side auth remains authoritative
- **High-risk actions must declare risk and confirmation**
  - Examples: delete, send, publish, transfer
- **Agents must respect confirmation requirements** — no silent execution of `high` + `required`
- **Review mode (`confirm="review"`)** — agent fills the form but does not submit; three tiers: `optional` (auto), `review` (fill only), `required` (blocked)
- **CSRF and session protections still apply** — this standard does not replace web security controls
- **Manifests must not leak hidden capabilities** — only expose actions available to the current user/app context
- **Idempotency should be declared** — prevent accidental retries causing duplicate effects
- **Audit logging should be supported** — especially for agent-triggered actions

### 7.2 Privacy Rules

- Do not embed sensitive private metadata in DOM annotations
- Do not expose internal IDs unless needed
- Prefer scoped, short-lived tokens for automation runtimes
- Make agent actions visible/auditable to the user when possible
- Avoid "hidden agent-only controls" that users cannot see or understand

---

## 8. Conformance Model

To make this standard real, define conformance.

### 8.1 Authoring Conformance (sites)

A conforming site:

- Uses valid `data-agent-*` attributes
- Ensures semantics reflect actual behavior
- Labels high-risk actions correctly
- Does not claim false idempotency
- Exposes a valid manifest (if provided)
- Keeps manifest and DOM semantics aligned

### 8.2 Agent Conformance (clients/runtimes)

A conforming agent/runtime:

- Prefers semantic selectors over brittle selectors when available
- Validates inputs against manifest schemas
- Respects risk/confirmation metadata
- Does not fabricate missing required fields
- Does not treat semantics as authorization
- Emits structured execution logs

### 8.3 Generator Conformance (tooling)

A conforming generator:

- Validates manifest syntax and schemas
- Validates DOM/manifest alignment
- Generates consistent SDK/CLI naming
- Preserves risk/confirmation metadata in generated interfaces
