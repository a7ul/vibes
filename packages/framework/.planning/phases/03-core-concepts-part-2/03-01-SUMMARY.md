---
phase: 03-core-concepts-part-2
plan: "01"
subsystem: docs
tags: [documentation, hitl, testing, debugging, otel, mdx]
dependency_graph:
  requires: []
  provides: [CONCEPT-09, CONCEPT-10, CONCEPT-11]
  affects: [docs/concepts/]
tech_stack:
  added: []
  patterns:
    - "Mintlify MDX with Mermaid diagrams"
    - "API reference tables"
    - "CardGroup footer navigation"
key_files:
  created:
    - docs/concepts/human-in-the-loop.mdx
    - docs/concepts/testing.mdx
    - docs/concepts/debugging.mdx
  modified: []
decisions:
  - "Used sequenceDiagram for HITL approval flow (interaction pattern) and graph TD for OTel span hierarchy (structural hierarchy)"
  - "Testing page adds sequenceDiagram for TestModel turn flow to meet mermaid-per-page requirement"
  - "ExternalToolset vs requiresApproval callout distinguishes the two HITL entry points clearly"
  - "instrumentAgent note explicitly states Vibes creates no custom spans — AI SDK telemetry convention applies"
metrics:
  duration: "2 min"
  completed_date: "2026-03-14"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 3 Plan 1: Advanced Concept Pages (HITL, Testing, Debugging) Summary

Three advanced concept pages authored against verified framework APIs: HITL approval flows with `requiresApproval`/`ApprovalRequiredError`/`agent.resume()`, deterministic agent testing with `TestModel`/`FunctionModel`/`captureRunMessages`, and OTel instrumentation with `instrumentAgent()`.

## What Was Built

### Task 1: human-in-the-loop.mdx
Full HITL approval flow documentation. Covers:
- `requiresApproval: true` on `tool()` — throws `ApprovalRequiredError` before `execute`
- `ApprovalRequiredError` catch pattern and `err.deferred.requests` iteration
- `agent.resume(deferred, results)` with both `result` and `argsOverride` options
- `ExternalToolset` with `ExternalToolDefinition[]` for client-side JSON Schema tools
- Sequence diagram showing the full App → Agent → Human → resume flow
- API reference table with all HITL symbols

### Task 2: testing.mdx
Complete testing toolkit documentation. Covers:
- `setAllowModelRequests(false)` module-level guard with Warning callout
- `TestModel` with `callTools`, `text`, `outputSchema` options table
- `createTestModel({ outputSchema })` convenience factory
- `FunctionModel` with 2-turn example showing tool call → text
- `captureRunMessages` with Warning about concurrency limitation
- `agent.override()` — clarifies it returns `{ run, stream, runStreamEvents }` not an `Agent`
- Sequence diagram showing TestModel auto-generate turn flow

### Task 3: debugging.mdx
OTel instrumentation documentation. Covers:
- `instrumentAgent(agent, options)` with all `InstrumentationOptions`
- Inline `TelemetrySettings` on `AgentOptions`
- `excludeContent: true` for GDPR compliance
- OTel span hierarchy graph (graph TD) showing per-turn and per-tool spans
- Note clarifying Vibes delegates to Vercel AI SDK — no custom spans
- External link to Vercel AI SDK telemetry docs

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed in sequence with correct APIs from research.

## Self-Check: PASSED

- FOUND: docs/concepts/human-in-the-loop.mdx (commit e9e8c2c)
- FOUND: docs/concepts/testing.mdx (commit 8e71400)
- FOUND: docs/concepts/debugging.mdx (commit 93b9ded)
