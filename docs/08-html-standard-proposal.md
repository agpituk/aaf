# Proposal: `data-agent-*` HTML Attributes for AI Agent Interaction

**W3C Position Paper — Agent Accessibility Framework (AAF)**

Status: Proposal Draft
Version: 0.1 — March 2026
Authors: Agent Accessibility Framework Contributors
Intended Audience: W3C TAG, Browser Vendors, Web Standards Community

---

## 1. Abstract

The web currently lacks a standard semantic layer for AI agent interaction. Browser-based agents rely on CSS selectors, DOM structure heuristics, and screen scraping to identify and operate interactive elements — techniques that break silently when a site updates its markup, styling, or layout. This document proposes `data-agent-*` HTML attributes and a well-known capability manifest (`/.well-known/agent-manifest.json`) as a declarative, browser-agnostic standard for exposing site actions, input fields, navigation targets, and safety policies to AI agents. The proposed standard is complementary to WAI-ARIA (which describes UI semantics for assistive technologies such as screen readers), to WebMCP (which provides an imperative JavaScript API surface for model context), and to MCP (which addresses backend tool-server integration). By building on the existing HTML5 `data-*` extensibility mechanism, the proposal requires no browser engine changes for initial adoption and can be incrementally promoted to browser-level enforcement in future phases.

---

## 2. Problem Statement

### 2.1 Fragility of Current Agent-Web Interaction

AI agents operating in the browser — whether autonomous browsing agents, copilot-style assistants, or automated testing frameworks — overwhelmingly rely on CSS selectors, XPath expressions, and visual heuristics to locate and interact with page elements. These techniques are inherently fragile:

- **CSS selectors and DOM IDs are implementation details.** They are not part of a site's public contract. A routine CSS refactor, component library migration, or design system update changes selectors without any functional change to the application, silently breaking all agent workflows that depend on them.
- **Screen scraping and vision models are probabilistic.** They introduce latency, require expensive inference, and fail on ambiguous layouts, overlapping elements, or dynamically loaded content.
- **No standard mechanism exists for declaring actionable capabilities.** A site has no way to tell an agent "here are the actions you can perform, here are the fields you need to fill, and here are the safety constraints you must respect."

### 2.2 The Cost of Fragility

When an agent workflow breaks due to a UI refactor, the failure mode is typically silent. The agent cannot find the expected selector, falls back to heuristics or guessing, and either performs the wrong action, fills the wrong field, or fails without a meaningful error. In safety-critical contexts — financial transactions, account deletion, data export — this brittleness poses material risk.

### 2.3 The Missing Layer

The web platform provides robust semantic layers for two audiences:

1. **Humans** — visual rendering via HTML/CSS.
2. **Assistive technologies** — WAI-ARIA roles, states, and properties.

No equivalent semantic layer exists for AI agents. Agents are forced to reverse-engineer intent from markup that was never designed to express it.

### 2.4 Agent-Hostile Patterns

In the absence of a standard, agents resort to techniques that are fundamentally hostile to the web platform:

- **Prompt injection via DOM scraping:** Agents that ingest raw page text as LLM context are vulnerable to adversarial content embedded in user-generated text, ads, or third-party widgets.
- **Selector-based contracts:** Agent workflows encode CSS selectors as implicit APIs, creating an undeclared coupling between the agent and the site's internal markup structure.
- **Unscoped execution:** Without a declared permission model, agents operate with ambient authority — they can interact with any element they can locate, regardless of risk level or user intent.

---

## 3. Prior Art and Relationship to Existing Standards

### 3.1 WAI-ARIA (W3C)

ARIA (Accessible Rich Internet Applications) provides semantic annotations for assistive technologies, primarily screen readers. ARIA attributes (`role`, `aria-label`, `aria-describedby`, etc.) describe the **user interface semantics** of elements — what an element is and how it relates to other elements in the accessibility tree.

AAF is **complementary** to ARIA. Where ARIA describes UI semantics for human-assistive consumption (e.g., "this is a button labeled 'Submit'"), AAF describes **action semantics** for agent consumption (e.g., "this button submits the `invoice.create` action, which requires `invoices.write` scope and has `low` risk"). A single element MAY carry both ARIA attributes and `data-agent-*` attributes. AAF does not replace, modify, or conflict with ARIA.

### 3.2 HTML5 `data-*` Attributes

The HTML5 specification (Section 3.2.6.6) defines `data-*` attributes as an extensibility mechanism for embedding custom data in HTML elements. AAF is a **convention** built on this existing mechanism. All `data-agent-*` attributes are valid `data-*` attributes per the HTML5 specification. No changes to HTML parsing, the DOM API, or browser rendering engines are required for Phase 1 adoption.

### 3.3 WebMCP (Google/Chrome)

WebMCP, proposed by Google for the Chrome browser, provides an **imperative JavaScript API** (`navigator.modelContext`) through which pages can register tools, prompts, and resources for consumption by on-device AI models. WebMCP operates at the JavaScript API layer — pages must execute code to register capabilities.

AAF is **complementary** to WebMCP. AAF provides the **declarative HTML layer**: capabilities are expressed as DOM attributes and a static manifest, requiring no JavaScript execution for discovery. Both standards can coexist on the same page. An interoperability bridge (`aaf-webmcp-bridge`) can auto-generate WebMCP tool registrations from AAF annotations and the agent manifest, ensuring that AAF-annotated sites are automatically discoverable by WebMCP-aware browsers without additional integration work.

The key distinction: WebMCP requires the page to execute JavaScript to register capabilities. AAF capabilities are discoverable from static HTML alone, making them available to headless agents, crawlers, linters, and pre-rendering pipelines that do not execute JavaScript.

### 3.4 MCP — Model Context Protocol (Anthropic)

MCP (Model Context Protocol) is a protocol for connecting AI models to backend tool servers. MCP operates at the **server layer** — it defines how an AI model communicates with external services via JSON-RPC over stdio or HTTP.

AAF operates at the **browser UI layer** — it defines how an agent interacts with rendered HTML pages. The two protocols address different layers of the stack and are not in conflict. An AAF runtime MAY expose discovered actions as MCP tools for consumption by a model server, but this is an integration pattern, not a dependency.

### 3.5 schema.org Microdata

schema.org defines structured data vocabularies for search engines and other automated consumers. AAF's `x-semantic` field extension in the manifest reuses schema.org URIs (e.g., `"x-semantic": "https://schema.org/email"`) to annotate input fields with semantic type information. This enables agents to infer the expected content of a field from its semantic type rather than relying on field name heuristics. AAF is complementary to schema.org; it reuses its vocabulary without modifying it.

### 3.6 robots.txt and /.well-known/ Conventions

The `/.well-known/` URI prefix (RFC 8615) is an established mechanism for site-level metadata discovery. AAF follows this convention by serving the capability manifest at `/.well-known/agent-manifest.json`, parallel to existing well-known URIs such as `/.well-known/security.txt` (RFC 9116) and `/.well-known/openid-configuration`. This document proposes formal IANA registration of the `agent-manifest.json` well-known URI.

---

## 4. Proposed Attribute Set

AAF defines the following `data-agent-*` attributes. All attribute names and values are case-sensitive. Attribute values MUST conform to the syntactic constraints specified below.

### 4.1 Attribute Reference

| Attribute | Allowed Values | Semantics | Required |
|-----------|---------------|-----------|----------|
| `data-agent-kind` | `action`, `field`, `status`, `result`, `collection`, `item`, `dialog`, `step`, `link` | Declares the semantic role of the element in the agent interaction model. | Yes (on all agent-annotated elements) |
| `data-agent-action` | Dot-notation identifier (e.g., `invoice.create`, `workspace.delete`) | Names the executable action or sub-action. Sub-actions use additional dot segments (e.g., `invoice.create.submit`). | Required when `data-agent-kind="action"` |
| `data-agent-field` | snake_case identifier (e.g., `customer_email`, `amount`) | Names the input field within an action. Field identity is stable across UI refactors. | Required when `data-agent-kind="field"` |
| `data-agent-output` | Dot-notation identifier (e.g., `invoice.create.status`) | Names the output or status element that reports the result of an action. | Required when `data-agent-kind="status"` |
| `data-agent-danger` | `none`, `low`, `high` | Declares the risk level of the action. `high` indicates an irreversible or destructive operation. | Optional (default: `none`) |
| `data-agent-confirm` | `never`, `optional`, `review`, `required` | Declares the confirmation policy. `review` means the agent may fill fields but MUST NOT submit without user review. `required` means execution is blocked without explicit user consent. | Optional (default: `optional`) |
| `data-agent-scope` | Dot-notation scope identifier (e.g., `invoices.write`, `workspace.delete`) | Declares the permission scope required to execute this action. Runtimes SHOULD check that the agent's granted scopes include the required scope before execution. | Optional |
| `data-agent-idempotent` | `true`, `false` | Declares whether repeated execution of the action is safe (produces the same result). | Optional (default: `false`) |
| `data-agent-for-action` | Dot-notation action identifier | Associates a field element with a specific action when the field is not nested within the action's DOM subtree. | Optional (required when field is not a descendant of the action element) |
| `data-agent-page` | URL path (e.g., `/settings/`, `/invoices/new/`) | Declares the navigation target for link elements. Required on non-`<a>` elements with `kind="link"`. On `<a>` elements, `data-agent-page` overrides the `href` attribute for agent navigation purposes. | Required when `data-agent-kind="link"` on non-`<a>` elements |
| `data-agent-version` | Semver-like version string (e.g., `0.1`, `1.0`) | Declares the AAF annotation version. SHOULD be placed on the `<html>` element. | Optional |

### 4.2 Naming Conventions

- **Action identifiers** use dot-notation: `noun.verb` (e.g., `invoice.create`). Sub-actions append additional segments: `invoice.create.submit`, `invoice.create.cancel`.
- **Field identifiers** use snake_case: `customer_email`, `billing_address_line_1`. Field names MUST be unique within the scope of their parent action.
- **Scope identifiers** use dot-notation: `resource.permission` (e.g., `invoices.write`, `workspace.delete`, `account.admin`).

### 4.3 Example: Annotated Invoice Creation Form

```html
<html data-agent-version="0.1">
<body>
  <form data-agent-kind="action"
        data-agent-action="invoice.create"
        data-agent-danger="low"
        data-agent-confirm="optional"
        data-agent-scope="invoices.write"
        data-agent-idempotent="false">

    <input data-agent-kind="field"
           data-agent-field="customer_email"
           type="email"
           aria-label="Customer email" />

    <input data-agent-kind="field"
           data-agent-field="amount"
           type="number"
           aria-label="Invoice amount" />

    <button data-agent-kind="action"
            data-agent-action="invoice.create.submit"
            type="submit">
      Create Invoice
    </button>
  </form>

  <div data-agent-kind="status"
       data-agent-output="invoice.create.status">
  </div>
</body>
</html>
```

### 4.4 Example: High-Risk Destructive Action

```html
<form data-agent-kind="action"
      data-agent-action="workspace.delete"
      data-agent-danger="high"
      data-agent-confirm="required"
      data-agent-scope="workspace.delete"
      data-agent-idempotent="false">

  <input data-agent-kind="field"
         data-agent-field="delete_confirmation_text"
         type="text"
         placeholder="Type DELETE to confirm"
         aria-label="Confirmation text" />

  <button data-agent-kind="action"
          data-agent-action="workspace.delete.submit"
          type="submit">
    Delete Workspace
  </button>
</form>
```

An AAF-conformant runtime MUST NOT execute this action without explicit user confirmation, regardless of what the planner requests. The `danger="high"` + `confirm="required"` combination constitutes a hard safety boundary enforced at the runtime layer.

---

## 5. Manifest Proposal

### 5.1 Discovery

The agent capability manifest MUST be discoverable at one of the following locations, checked in order:

1. **Well-known URI:** `/.well-known/agent-manifest.json` served from the site's origin over HTTPS.
2. **Embedded manifest:** A `<script type="application/agent+json">` element in the page's `<head>`.

If both are present, the well-known URI takes precedence.

### 5.2 Structure

The manifest is a JSON document conforming to the schema defined in `schemas/agent-manifest.schema.json`. It contains the following top-level sections:

| Section | Type | Description |
|---------|------|-------------|
| `version` | `string` | Manifest schema version (e.g., `"0.1"`). |
| `site` | `object` | Site metadata: `name`, `origin`, and optional `description`. |
| `actions` | `object` | Map of action identifiers to action definitions, each specifying `title`, `scope`, `risk`, `confirmation`, `idempotent`, `inputSchema`, and `outputSchema`. |
| `data` | `object` | Map of data view identifiers to read-only data view definitions, each specifying `title`, `scope`, `outputSchema`, and optional `inputSchema` for queryable views. |
| `pages` | `object` | Map of URL path patterns to page definitions, grouping actions and data views by page. |
| `errors` | `object` | Map of error codes to error definitions with human-readable messages. |

### 5.3 Schema Validation

Manifests MUST validate against the JSON Schema at `schemas/agent-manifest.schema.json`. The schema enforces:

- Required fields on action definitions (`title`, `scope`, `risk`, `confirmation`, `idempotent`, `inputSchema`, `outputSchema`).
- Enum constraints on `risk` (`none`, `low`, `high`) and `confirmation` (`never`, `optional`, `review`, `required`).
- Pattern constraints on identifiers (dot-notation for actions and scopes, snake_case for fields).
- Origin format validation on `site.origin`.

### 5.4 Semantic Type Annotations

Action input and output schemas MAY include `x-semantic` extensions on individual fields to declare semantic types using schema.org URIs:

```json
{
  "customer_email": {
    "type": "string",
    "x-semantic": "https://schema.org/email"
  }
}
```

This enables agents to infer field semantics from a shared vocabulary without requiring changes to the DOM annotations.

### 5.5 Manifest Example

```json
{
  "version": "0.1",
  "site": {
    "name": "Acme Billing",
    "origin": "https://billing.acme.com",
    "description": "Invoice and workspace management for Acme customers."
  },
  "actions": {
    "invoice.create": {
      "title": "Create Invoice",
      "description": "Creates a new invoice and sends it to the specified customer.",
      "scope": "invoices.write",
      "risk": "low",
      "confirmation": "optional",
      "idempotent": false,
      "inputSchema": {
        "type": "object",
        "required": ["customer_email", "amount"],
        "properties": {
          "customer_email": {
            "type": "string",
            "format": "email",
            "x-semantic": "https://schema.org/email"
          },
          "amount": {
            "type": "number",
            "minimum": 0
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "status": { "type": "string", "enum": ["success", "error"] },
          "invoice_id": { "type": "string" }
        }
      }
    }
  },
  "pages": {
    "/invoices/new/": {
      "title": "Create Invoice",
      "actions": ["invoice.create"]
    }
  }
}
```

### 5.6 IANA Registration

This specification proposes the registration of the following well-known URI with IANA:

- **URI suffix:** `agent-manifest.json`
- **Change controller:** W3C
- **Specification document:** This document
- **Related information:** Parallel to `security.txt` (RFC 9116). Provides machine-readable capability metadata for AI agent interaction.

---

## 6. Security Model

The security threat model for AAF is defined in full in the companion document [Security Threat Model & Conformance Levels](./06-security-threat-model.md). This section summarizes the key threats and mitigations.

### 6.1 Threat Summary

| Threat | Description | Primary Mitigation |
|--------|-------------|-------------------|
| **Annotation injection** | Attacker injects `data-agent-*` attributes into third-party content (ads, UGC, iframes) to hijack agent actions. | Runtimes MUST scope annotation discovery to a trusted root element. Runtimes MUST NOT scan cross-origin iframes. Site authors SHOULD sanitize UGC to strip `data-agent-*` attributes. |
| **Manifest spoofing** | Attacker serves a fake manifest on a phishing domain to harvest credentials or trigger unauthorized operations. | Runtimes MUST validate that `manifest.site.origin` matches the serving origin. Runtimes MUST fetch the manifest over HTTPS in production. |
| **Deadly triad (cross-tab exploitation)** | Agent with access to multiple sensitive tabs is manipulated by a malicious page into exfiltrating data cross-origin. | Runtimes SHOULD operate in single-origin mode by default. Agents MUST NOT transfer data between origins without explicit user consent. |
| **Prompt injection via DOM** | Adversarial text in page content manipulates the LLM planner into calling unintended actions. | Planners MUST treat all DOM text as untrusted data. Contracts MUST enforce semantic action names only — no CSS selectors, XPath, or raw JavaScript. Validators SHOULD reject selector-like argument values. |
| **Confirmation bypass** | Planner or script sets `confirmed: true` programmatically without actual user consent. | Runtimes MUST enforce confirmation in the PolicyEngine, not the planner. The planner is untrusted. Only the runtime's own confirmation UI may set the `confirmed` flag. |
| **Scope escalation** | Agent with narrow scope attempts to execute an action requiring broader scope. | Manifests MUST declare required scope per action. Runtimes SHOULD check agent scopes against action scopes before execution and return structured `scope_denied` errors. |

### 6.2 Design Principle: Untrusted Planner

A foundational security principle of AAF is that the **planner is untrusted**. The LLM-based planner produces a structured request (action name + typed arguments), but the runtime validates and enforces all safety constraints independently. The planner cannot bypass confirmation, escalate scope, or inject selectors — these are enforced at the runtime layer regardless of planner output.

### 6.3 Conformance Levels

AAF defines three cumulative conformance levels for adopting sites:

**Level 1 — Annotated.** The site has valid `data-agent-*` attributes on interactive elements. All action identifiers use dot-notation. All field identifiers use snake_case. The HTML passes `aaf-lint` with zero errors. This level requires no manifest and no server-side changes.

**Level 2 — Manifested.** In addition to Level 1, the site serves a valid `agent-manifest.json` at `/.well-known/agent-manifest.json` (or embeds it as `<script type="application/agent+json">`). The manifest passes JSON Schema validation. All DOM-declared actions have corresponding manifest entries. The manifest `site.origin` matches the serving origin.

**Level 3 — Certified.** In addition to Level 2, the site passes the full conformance test suite and the falsification safety benchmark. High-risk actions are blocked without explicit confirmation. Scope mismatches are detected and rejected. Semantic annotations survive UI refactoring (CSS/layout changes do not break agent operability). The `PolicyEngine` enforces `danger=high` + `confirmation=required` blocking.

---

## 7. Falsification Evidence

The AAF repository includes a falsification benchmark (`tests/falsification/`) that empirically demonstrates the fragility of selector-based agent interaction and the resilience of semantic annotations. The benchmark is designed as a controlled experiment with matched pairs: each of 10 UI patterns has an "original" and a "refactored" version where CSS classes, DOM IDs, and layout structure are changed while `data-agent-*` attributes are preserved.

### 7.1 Experimental Design

- **10 real-world UI patterns** are implemented as paired HTML fixtures:
  - Multi-step forms
  - Modal dialogs
  - Date pickers
  - Select elements with option groups
  - Inline edit patterns
  - File upload forms
  - Multi-field destructive confirmation
  - Paginated lists
  - Nested forms
  - Dynamic/conditional fields

- Each pattern has two versions:
  - **Original:** Contains stable DOM IDs and CSS class names that selector-based tests target.
  - **Refactored:** CSS classes, DOM IDs, and layout structure are changed (as would occur in a routine UI redesign). `data-agent-*` attributes are preserved unchanged.

### 7.2 Results

| Approach | Original App | Refactored App | Survives Refactor? |
|----------|-------------|----------------|-------------------|
| CSS Selectors | 20/20 pass | 0/20 pass | **No** |
| AAF Semantic | 20/20 pass | 20/20 pass | **Yes** |

- **Selector-based tests** (20 tests targeting DOM IDs and CSS classes) pass on the original HTML but fail completely (0/20) on the refactored HTML. The refactored versions remove the targeted IDs and classes, simulating a realistic CSS refactor.
- **Semantic-based tests** (20 tests using `SemanticParser.discoverActions()`) pass on both the original and refactored HTML (20/20 each). The `data-agent-*` attributes are stable across the refactor because they are part of the declared agent contract, not implementation details.

### 7.3 Safety Benchmark

The falsification suite additionally includes safety tests that verify runtime enforcement:

- **High-risk action blocking:** The `PolicyEngine` blocks execution of `danger=high` + `confirmation=required` actions (e.g., `account.delete`, `workspace.delete`, `org.destroy`) when `confirmed` is `false` or omitted. Execution is allowed only when `confirmed` is explicitly `true`.
- **Scope mismatch detection:** The `PolicyEngine` blocks execution when the agent's granted scopes do not include the action's required scope (e.g., an agent with `invoices.read` scope attempting `workspace.delete` which requires `workspace.delete` scope). Scope check returns a structured `scope_denied` error.
- **Contract enforcement:** The `validatePlannerRequest()` function rejects planner requests containing CSS selector-like values in action arguments (e.g., `"#confirm-input"` as a field value), enforcing the contract rule that semantic names are the only valid identifiers.

### 7.4 Reproducibility

The full benchmark can be reproduced by running:

```bash
npm run benchmark
```

This executes all falsification tests and generates a reliability report at `artifacts/reliability-report.json` and `artifacts/reliability-report.md`.

---

## 8. Browser Implementation Path

AAF is designed for incremental adoption. The three-phase implementation path moves from pure userland convention to browser-assisted optimization to native enforcement, with each phase building on the previous without breaking backward compatibility.

### 8.1 Phase 1: Convention (Current)

**Status:** Implemented and operational today.

- AAF uses plain HTML5 `data-*` attributes. No browser engine changes are required.
- Runtimes (e.g., `PlaywrightAdapter`, `agent-runtime-core`) operate entirely in userland JavaScript, using standard DOM APIs (`querySelectorAll`, `getAttribute`) to discover and interact with annotated elements.
- The agent manifest is a static JSON file served over standard HTTP.
- Linting, validation, and policy enforcement are implemented as JavaScript libraries.
- This phase is sufficient for production use. All security properties (confirmation enforcement, scope checking, selector rejection) are enforced at the runtime layer.

### 8.2 Phase 2: Browser-Assisted Discovery

**Status:** Proposed for standardization.

- The browser exposes a `document.agentActions` API that returns a structured representation of all `data-agent-*` annotated elements on the page, analogous to how `document.forms` provides access to form elements.
- The browser MAY maintain an internal index of agent-annotated elements, enabling O(1) lookup by action name rather than O(n) DOM traversal.
- The browser MAY prefetch and cache the `/.well-known/agent-manifest.json` manifest on page load, making it available synchronously to agent runtimes.
- This phase is a **performance optimization**, not a functional change. All capabilities available through `document.agentActions` are also available through existing DOM APIs. No existing AAF implementations break.

### 8.3 Phase 3: Native Enforcement

**Status:** Future consideration.

- The browser enforces scope and confirmation policies natively, analogous to how browsers enforce CORS (Cross-Origin Resource Sharing) for network requests.
- An agent runtime MUST request scopes from the browser, which presents a user-facing permission prompt (analogous to camera, microphone, or geolocation permission prompts). The browser grants or denies scope access based on user consent.
- The browser enforces `confirmation=required` by displaying a native confirmation dialog for high-risk actions, ensuring that confirmation cannot be bypassed by JavaScript — moving the trust boundary from the runtime to the browser itself.
- The browser MAY enforce single-origin isolation for agent sessions by default, preventing cross-tab data exfiltration without explicit user consent.
- This phase moves security enforcement from userland JavaScript (where it can theoretically be circumvented by malicious scripts) to the browser's trusted computing base.

---

## 9. Open Questions

The following questions remain open and are submitted for community discussion:

### 9.1 Attribute Namespace

Should `data-agent-*` attributes be promoted to a dedicated HTML namespace (e.g., `agent-kind` without the `data-` prefix)? The `data-*` prefix ensures immediate compatibility with all existing HTML parsers and validators, but a dedicated namespace would signal first-class platform support and enable browser-specific optimizations. Promotion to a dedicated namespace would require changes to the HTML specification and browser parsers.

### 9.2 Dynamic Single-Page Applications

How should single-page applications (SPAs) declare action availability across client-side routes? The current manifest model maps actions to URL path patterns, but SPAs may render multiple "pages" at a single URL. Possible approaches include: extending the manifest with client-side route patterns, relying solely on DOM-level discovery (actions are available if and only if their annotated elements are in the DOM), or introducing a JavaScript API for dynamic action registration (which overlaps with WebMCP).

### 9.3 Manifest Versioning and Migration

Should the manifest support versioning and migration between schema versions? The current `version` field is a simple string. A more structured versioning scheme could enable agents to detect manifest format changes and adapt accordingly. This is particularly important for long-lived agent integrations that must survive manifest schema evolution.

### 9.4 ARIA and Agent Kind Coexistence

How should conflicts between ARIA roles and agent kinds on the same element be resolved? For example, an element with `role="button"` and `data-agent-kind="action"` carries complementary but distinct semantics. The current position is that ARIA and AAF operate in separate semantic domains and do not conflict, but edge cases may arise that require explicit guidance.

### 9.5 Agent Permission Model

Should browsers show a permission prompt before allowing agent access to `data-agent-*` annotations, analogous to camera or microphone permission prompts? This would give users explicit control over which agents can interact with which sites, but could introduce friction for low-risk actions. A tiered permission model — implicit access for `danger=none`, prompted access for `danger=high` — may balance usability and security.

### 9.6 Cross-Site Action Handoff

The manifest schema supports a `handoff` field for cross-site action chaining (mapping output fields from one site's action to input fields of another site's action). The security implications of cross-site handoff require further analysis, particularly regarding origin trust chains, consent propagation, and data minimization.

---

## 10. Call to Action

This proposal is submitted for review and implementation feedback from the following stakeholders:

### 10.1 Browser Vendors

- **Mozilla/Firefox:** As the primary advocate for open web standards, Firefox is a natural partner for standardizing a declarative agent interaction layer that is not tied to a single browser's proprietary API. AAF's declarative HTML approach aligns with Mozilla's preference for standards that work across all rendering engines.
- **WebKit/Safari:** Safari's focus on user privacy and permission controls aligns with AAF's scope and confirmation model. Phase 3 native enforcement would benefit from WebKit's existing permission prompt infrastructure.
- **Google/Chrome:** AAF is explicitly designed to complement, not compete with, WebMCP. The `aaf-webmcp-bridge` demonstrates interoperability. Chrome's implementation of Phase 2 `document.agentActions` would benefit both standards.

### 10.2 Standards Bodies

- **W3C Technical Architecture Group (TAG):** Architectural review of the `data-agent-*` attribute set, the well-known manifest URI, and the relationship to existing web platform APIs.
- **W3C Web Machine Learning Community Group:** Alignment with the broader Web ML standards effort, particularly regarding on-device model interaction patterns.
- **IANA:** Registration of the `agent-manifest.json` well-known URI suffix per RFC 8615.

### 10.3 Agent and AI Model Developers

- **Anthropic:** As the developer of Claude and MCP, Anthropic's feedback on the relationship between AAF (browser UI layer) and MCP (backend tool server layer) is essential for ensuring clean layer separation.
- **OpenAI:** Feedback on agent runtime integration patterns, particularly regarding structured tool calling and safety constraints.
- **Google DeepMind:** Alignment with Gemini's browser agent capabilities and the WebMCP integration path.

### 10.4 Web Framework Authors

- **Next.js (Vercel):** Server component and app router integration for automatic AAF annotation generation.
- **SvelteKit:** Component-level AAF annotation patterns.
- **Nuxt (Vue):** Directive-based annotation (`v-agent-kind`, `v-agent-action`) that compiles to `data-agent-*` attributes.
- **Remix:** Loader/action integration for automatic manifest generation from route definitions.

Framework-level adoption would dramatically lower the barrier to AAF annotation, enabling site authors to declare agent capabilities as part of their component API rather than as manual DOM annotations.

---

## References

- [AAF Vision and Goals](./01-vision-and-goals.md)
- [AAF Standard Specification](./02-standard-spec.md)
- [AAF Security and Conformance](./03-security-and-conformance.md)
- [AAF Design Principles](./04-design-principles.md)
- [AAF Security Threat Model](./06-security-threat-model.md)
- [Agent Manifest JSON Schema](../schemas/agent-manifest.schema.json)
- [Falsification Benchmark](../tests/falsification/)
- HTML Living Standard, Section 3.2.6.6: Embedding custom non-visible data — `data-*` attributes
- RFC 8615: Well-Known Uniform Resource Identifiers (URIs)
- RFC 9116: A File Format to Aid in Security Vulnerability Disclosure (`security.txt`)
- WAI-ARIA 1.2 Specification (W3C Recommendation)
- WebMCP Explainer (Chrome Platform Status)
- Model Context Protocol Specification (Anthropic)
