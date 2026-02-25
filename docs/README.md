# Agent-Native Web

## Draft v0.1 — Vision, Standard, SDK Generation, and Automation Plan

> A draft standard and tooling stack for agent-native websites. It adds semantic
> annotations to the DOM and a typed manifest so agents can interact with websites
> safely and reliably.

---

## Table of Contents

| # | Document | Covers |
|---|----------|--------|
| 1 | [Vision and Goals](01-vision-and-goals.md) | Vision, core idea, goals, terminology, architecture overview |
| 2 | [Standard Spec v0.1](02-standard-spec.md) | DOM annotations, attribute reference, HTML examples, capability manifest |
| 3 | [Tooling and Generation](03-tooling.md) | SDK generation, CLI generation, automation runtime, agent widget, Harbor integration, MCP integration |
| 4 | [Security and Conformance](04-security-and-conformance.md) | Security rules, privacy rules, conformance model |
| 5 | [Implementation Plan](05-implementation-plan.md) | Reference implementations, monorepo structure, spec plan, roadmap |
| 6 | [Design Principles and Examples](06-design-principles.md) | MVP scope, design principles, end-to-end example flows |
| 7 | [Future and Appendices](07-future-and-appendices.md) | Open questions, standardization strategy, stretch goals, attribute summary |

---

## One-Liner

> ARIA gave the web accessibility semantics. We want to give it **agent interaction semantics**.

## What Gets Generated?

- SDKs (TypeScript, Python)
- CLIs
- Optional MCP wrappers
- Conformance tests
- Embeddable agent widget (single `<script>` tag, Harbor/Ollama LLM)

## Why Not Just Tools?

Because many real workflows still need actual website interaction — typing, clicking, previews, dialogs, page state. This is not "replace the website with tools." This is **"make the website itself agent-native."**
