# Vision and Goals

## 1. Vision

Websites today are built for humans and partially for assistive technologies (via ARIA), but not for software agents.

LLM agents can interact with websites, but they usually do it in brittle ways:

- Guessing selectors
- Relying on visual position
- Breaking when UI labels or layouts change
- Triggering risky actions without clear semantics

We want to build a new layer for the web:

- **UI remains the source of truth for humans**
- **DOM exposes agent-readable semantics**
- **A typed manifest provides stable capabilities**
- **Tooling auto-generates SDKs, CLIs, and browser automation wrappers**
- **Agents can still interact with the website itself** (typing, clicking, reading state), not just backend APIs

This is not "replace the website with tools."

This is "make the website itself agent-native."

---

## 2. Core Idea

Add a new semantic layer to the web, similar in spirit to ARIA, but focused on agent interaction.

### ARIA Solves

- Accessibility semantics for assistive technologies

### This Proposal Solves

- Automation semantics for LLM/browser agents

Examples of semantics we want agents to understand:

- "this form creates an invoice"
- "this field is `customer_email`"
- "this button is high-risk"
- "this action needs confirmation"
- "this action maps to `workspace.delete`"
- "this requires `invoices.write` scope"

---

## 3. Goals

### Goals

- Make browser-based agent interaction reliable
- Keep interaction at the website/UI level when needed
- Add machine-readable semantics to DOM
- Add typed capability manifests for generation and validation
- Enable auto-generated SDKs and CLIs per site
- Enable optional MCP wrappers on top of the same semantics
- Improve safety with risk levels and confirmations
- Improve auditability and reproducibility

### Non-Goals

- Replacing ARIA
- Replacing existing APIs
- Granting permissions automatically
- Bypassing authentication
- Hiding privileged actions in metadata
- Forcing all sites to expose backend tools

---

## 4. Terminology

| Term | Definition |
|------|------------|
| **Agent** | Software system (LLM or otherwise) interacting with a website |
| **Agent Semantics** | Machine-readable metadata describing UI intent |
| **Agent Action** | A named operation represented in UI or manifest (e.g., `invoice.create`) |
| **Agent Field** | Logical input/output field name (e.g., `customer_email`) |
| **Risk Level** | Metadata indicating action sensitivity (`none`, `low`, `high`) |
| **Confirmation** | Whether explicit confirmation is required |
| **Manifest** | Typed machine-readable capability description |
| **Generator** | Tool that creates SDK/CLI/MCP wrappers from semantics + manifest |
| **Agent Runtime** | Browser automation layer that executes UI interactions using semantics |

---

## 5. Architecture Overview

The system has 4 layers.

### 5.1 UI Layer (existing website)

Human-facing website or web app.

### 5.2 Agent Semantics Layer (new)

DOM annotations that describe intent, fields, action types, risk, scopes.

### 5.3 Agent Manifest Layer (new)

Typed schemas for actions, inputs, outputs, errors, scopes, and versioning.

### 5.4 Tooling Layer (generated)

From the manifest + annotations, generate:

- Site SDKs (TypeScript, Python)
- Site CLIs
- MCP server wrappers (optional)
- Browser runtime integration helpers
- Test fixtures and conformance checks

### Diagram

```text
Human UI (website)
    |
    +-- DOM + data-agent-* semantics
    |
    +-- /.well-known/agent-manifest.json
            |
            +-- agentgen (generator)
                    |
                    +-- site-agent-sdk (TS/Python)
                    +-- site-agent-cli
                    +-- site-mcp-wrapper
                    +-- conformance tests
                    +-- docs/examples

Agent runtime (browser automation)
    |
    +-- uses data-agent-* to find and operate UI safely
```
