# 09 — Multi-Agent Handoff Protocol

## 1. Introduction

The Agent Accessibility Framework (AAF) defines how a single agent discovers and
executes actions on a single site. WebMCP similarly scopes its tool surface to
one origin. Neither specification addresses what happens when an agent operating
on **Site A** needs to pass a task — along with its output data — to an agent
operating on **Site B**.

Real-world workflows routinely span multiple services:

- An invoice created in a billing app must be imported into an accounting ledger.
- A shipping label generated in a warehouse system must be registered with a
  carrier's tracking service.
- A support ticket resolved on one platform must update a status dashboard on
  another.

This document sketches a **cross-site handoff protocol** that lets one
AAF-annotated site declare, in its manifest, that the output of a local action
can feed directly into the input of an action on a remote site. The protocol
prioritises user consent, data transparency, and minimal coupling between the
two sites.

---

## 2. The Handoff Data Model

A handoff is declared inside an action definition in the source site's
`agent-manifest.json`. It contains three pieces of information:

| Field | Type | Description |
|-------|------|-------------|
| `target` | `string` (URI) | URL of the target site's `agent-manifest.json`. |
| `targetAction` | `string` | Dot-notation action identifier on the target site. |
| `fieldMap` | `Record<string, string>` | Maps source output field names to target input field names. |

### Example

```json
{
  "invoice.export": {
    "title": "Export Invoice",
    "scope": "invoice.write",
    "risk": "low",
    "confirmation": "review",
    "idempotent": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "invoice_id": { "type": "string" }
      },
      "required": ["invoice_id"]
    },
    "outputSchema": {
      "type": "object",
      "properties": {
        "invoice_id": { "type": "string" },
        "amount": { "type": "number" },
        "currency": { "type": "string" }
      }
    },
    "handoff": {
      "target": "https://accounting.example.com/.well-known/agent-manifest.json",
      "targetAction": "ledger.import",
      "fieldMap": {
        "invoice_id": "source_document_id",
        "amount": "debit_amount",
        "currency": "currency_code"
      }
    }
  }
}
```

Here the source action `invoice.export` produces three output fields. The
`fieldMap` declares how each source field maps to the corresponding input field
on the target action `ledger.import` at `accounting.example.com`.

---

## 3. Trust Model

Cross-site handoffs transfer data between origins. The user **must explicitly
consent** before any data leaves the source site. The runtime presents a
permission dialog containing:

| Displayed | Source |
|-----------|--------|
| **Source site** | `site.name` and `site.origin` from the source manifest. |
| **Source action** | The action that was just executed (e.g. `invoice.export`). |
| **Target site** | Origin parsed from `handoff.target`. |
| **Target action** | `handoff.targetAction` (e.g. `ledger.import`). |
| **Data being transferred** | Every key-value pair from the source action's output that appears in `fieldMap`, shown as `sourceField -> targetField: value`. |

The dialog must include an explicit **Approve** and **Deny** option. Denying
aborts the handoff but does not roll back the source action (which has already
completed).

### Consent Persistence

In the initial version, consent is requested for every handoff invocation.
Future revisions may introduce a "remember this handoff" option scoped to
`(source origin, target origin, source action, target action)`.

---

## 4. Resolution Flow

When a source action completes and declares a `handoff`, the runtime executes
the following steps:

### Step 1 — Fetch Target Manifest

```
GET https://accounting.example.com/.well-known/agent-manifest.json
```

The runtime fetches the manifest from the URL in `handoff.target`. The request
must use HTTPS (except `localhost` during development). The runtime must validate
that the URL does not resolve to a private/internal IP address (see Security
Considerations).

### Step 2 — Validate Target Action

The runtime checks that `handoff.targetAction` (e.g. `ledger.import`) exists as
a key in the target manifest's `actions` map. If not found, the handoff fails
with an error.

### Step 3 — Validate Field Map

For every value in `handoff.fieldMap`, the runtime checks that it is a valid
property in the target action's `inputSchema`. For every key in
`handoff.fieldMap`, the runtime checks that it is a valid property in the source
action's `outputSchema`. Any mismatch is reported as an error.

### Step 4 — Present Consent Dialog

The runtime displays the consent dialog described in Section 3. If the user
denies, the handoff is aborted and the runtime returns a response with status
`"handoff_denied"`.

### Step 5 — Execute Source Action and Capture Output

If the source action has not yet been executed, the runtime executes it now and
captures the output. If it was already executed (e.g. the handoff is triggered
post-execution), the runtime uses the captured output from the previous
execution.

### Step 6 — Map Output Fields

The runtime constructs the target action's input by iterating over
`handoff.fieldMap`:

```typescript
const targetInput: Record<string, unknown> = {};
for (const [sourceField, targetField] of Object.entries(handoff.fieldMap)) {
  targetInput[targetField] = sourceOutput[sourceField];
}
```

### Step 7 — Navigate and Execute

The runtime navigates to the target site (the origin derived from
`handoff.target`) and locates the page containing `handoff.targetAction`. It
then executes the target action with the mapped input, following the standard
AAF execution flow (discover, validate, policy check, execute).

### Sequence Diagram

```
User                  Source Runtime           Target Runtime
 |                        |                        |
 |  execute invoice.export|                        |
 |----------------------->|                        |
 |                        | fetch target manifest  |
 |                        |----------------------->|
 |                        |<-----------------------|
 |                        | validate action + map  |
 |  consent dialog        |                        |
 |<-----------------------|                        |
 |  approve               |                        |
 |----------------------->|                        |
 |                        | execute source action  |
 |                        | map output fields      |
 |                        | navigate to target     |
 |                        |----------------------->|
 |                        |  execute ledger.import |
 |                        |<-----------------------|
 |  handoff complete      |                        |
 |<-----------------------|                        |
```

---

## 5. Security Considerations

### 5.1 SSRF via Target URL

A malicious manifest could set `handoff.target` to an internal network address
(e.g. `https://10.0.0.1/...` or `https://metadata.internal/...`), causing the
runtime to make requests to private infrastructure.

**Mitigation**: The runtime must:
- Require HTTPS for all non-localhost targets.
- Resolve the hostname and reject any target that maps to a private IP range
  (RFC 1918, link-local, loopback other than `localhost`).
- Implement a timeout for manifest fetches.
- Optionally maintain an allowlist of trusted manifest origins.

### 5.2 Scope Escalation

The target action may require permission scopes that the agent does not possess
on the target site. For example, the agent may have `invoice.read` on the source
site but `ledger.import` on the target site requires `ledger.write`.

**Mitigation**: The target runtime enforces its own policy checks independently.
The handoff protocol does not bypass any target-side validation. The agent must
authenticate separately on the target site.

### 5.3 Data Exfiltration

A compromised or malicious manifest could declare a handoff that maps sensitive
fields (e.g. `ssn`, `api_key`) to a target controlled by an attacker.

**Mitigation**:
- The consent dialog must display **every field and value** being transferred.
- The runtime should warn when fields with sensitive-sounding names (e.g.
  containing `password`, `secret`, `token`, `key`, `ssn`) appear in the
  `fieldMap`.
- Site owners should audit handoff declarations in their manifests.

### 5.4 Manifest Tampering

If the target manifest is modified between the time the handoff is declared and
the time it is executed, the field map may become invalid or point to a different
action than intended.

**Mitigation**: The runtime should re-fetch and re-validate the target manifest
at execution time, not cache it indefinitely. Future versions may support
manifest integrity hashes.

---

## 6. Open Questions

### 6.1 Synchronous vs. Asynchronous Handoff

The current design assumes a synchronous flow: the runtime navigates to the
target site and executes the action in the same session. This works for
browser-based agents but may not suit headless or background agents.

Should there be an asynchronous mode where the source runtime posts the mapped
input to a webhook or queue on the target site, and the target processes it
independently?

### 6.2 Cross-Site Authorization

The current design does not specify how the agent authenticates on the target
site. Options include:

- **OAuth 2.0**: The source site initiates an OAuth flow for the target site,
  requesting scopes needed by `targetAction`. This is the most standards-aligned
  approach but adds complexity.
- **Pre-shared tokens**: The user pre-configures API keys for known target sites.
  Simpler but harder to manage at scale.
- **Delegated identity**: The source site issues a signed assertion about the
  user's identity, which the target site trusts. Requires a federation mechanism.

### 6.3 Target Site Authentication

How does the agent prove to the target site that the handoff is legitimate? The
target site needs to verify that:

- The handoff was initiated by a real user (not a bot replaying captured data).
- The source action actually produced the claimed output.
- The user consented to the transfer.

A signed handoff token (JWT) from the source site could address this, but
requires key exchange infrastructure.

### 6.4 Handoff Registry / Directory

Should there be a public registry where sites advertise their willingness to
accept handoffs? This would let agents discover compatible target actions
dynamically rather than relying on hard-coded `handoff.target` URLs in source
manifests.

A registry could also enforce minimum security standards (HTTPS, valid manifest,
trusted origin) and provide a discovery API:

```
GET https://registry.aaf.dev/actions?accepts=invoice_data
```

### 6.5 Multi-Hop Handoffs

If the target action itself declares a handoff to a third site, should the
runtime support chaining? Multi-hop handoffs increase both power and risk. Each
hop would require independent user consent, but the UX of approving a chain of
transfers needs careful design.

### 6.6 Partial Field Maps

What happens when the source action's output contains fields not listed in the
`fieldMap`? Currently they are silently dropped. Should the runtime warn about
unmapped fields that exist in the target's `inputSchema`? Should it support a
wildcard mapping for pass-through?
