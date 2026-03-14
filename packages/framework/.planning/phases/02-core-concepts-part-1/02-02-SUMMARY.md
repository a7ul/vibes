---
phase: 02-core-concepts-part-1
plan: 02
subsystem: docs
tags: [documentation, mdx, concepts, toolsets, results, messages, streaming]
dependency_graph:
  requires: [02-01]
  provides: [CONCEPT-05, CONCEPT-06, CONCEPT-07, CONCEPT-08]
  affects: [docs/concepts/, docs/docs.json]
tech_stack:
  added: []
  patterns: [Mintlify MDX, Mermaid diagrams, Pydantic AI teaching flow]
key_files:
  created:
    - docs/concepts/toolsets.mdx
    - docs/concepts/results.mdx
    - docs/concepts/messages.mdx
    - docs/concepts/streaming.mdx
  modified:
    - docs/docs.json
key_decisions:
  - "event.kind (not event.type) is the correct AgentStreamEvent discriminant - warning callout added to streaming.mdx"
  - "newMessages included in both StreamResult table and code examples - was missing from existing docs"
  - "PrivacyRule uses { pattern, replacement? } for regex rules - { type: 'regex', redactValue } shape is wrong"
  - "outputTemplate is boolean not string - warning callout added to results.mdx"
  - "All 8 new concept pages added to docs.json Concepts nav; 3 existing pages retained until Phase 6"
metrics:
  duration: "3 min"
  completed_date: "2026-03-14"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
requirements_fulfilled: [CONCEPT-05, CONCEPT-06, CONCEPT-07, CONCEPT-08]
---

# Phase 02 Plan 02: Core Concepts Part 1 (Toolsets, Results, Messages, Streaming) Summary

**One-liner:** Four MDX concept pages covering toolsets (9 types + composition diagram), results (3 output modes + complete StreamResult), messages (multi-turn flow + 4 history processors + serialization), and streaming (event.kind discriminant fix + event timeline diagram).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create toolsets.mdx and results.mdx | ade7aa7 | docs/concepts/toolsets.mdx, docs/concepts/results.mdx |
| 2 | Create messages.mdx and streaming.mdx | 54c9e94 | docs/concepts/messages.mdx, docs/concepts/streaming.mdx |
| 3 | Update docs.json navigation | 0b977cb | docs/docs.json |

## What Was Built

### docs/concepts/toolsets.mdx
- Composition Mermaid graph showing per-turn tool resolution flow
- All 9 toolset types: FunctionToolset, FilteredToolset, PreparedToolset, CombinedToolset, PrefixedToolset, RenamedToolset, WrapperToolset, ApprovalRequiredToolset, ExternalToolset
- Comparison table: FilteredToolset (all-or-nothing) vs PreparedToolset (per-tool)

### docs/concepts/results.mdx
- Output mode flowchart: 'tool' (default), 'native', 'prompted'
- outputSchema with typed output example
- Union types as outputSchema
- Result validators with maxRetries
- Complete RunResult and StreamResult interface tables (includes newMessages)
- Warning callout: outputTemplate is boolean not string

### docs/concepts/messages.mdx
- Multi-turn sequence diagram: two runs with messageHistory
- serializeMessages/deserializeMessages with DB persistence example
- All 4 history processors: trimHistoryProcessor, tokenTrimHistoryProcessor, summarizeHistoryProcessor, privacyFilterProcessor
- Correct PrivacyRule shapes: { pattern, replacement? } for regex, { messageType, fieldPath } for field
- Warning callout: wrong { type: "regex", redactValue } shape
- Custom HistoryProcessor example

### docs/concepts/streaming.mdx
- Streaming event timeline sequence diagram
- agent.stream() with full StreamResult (textStream, partialOutput, output, messages, newMessages, usage)
- agent.runStreamEvents() with complete switch on event.kind
- AgentStreamEvent reference table with all 8 event kinds
- Warning callout: event.kind not event.type
- When-to-use comparison table

### docs/docs.json
- Concepts nav group expanded from 3 to 11 pages
- New pages added: agents, models, dependencies, tools, toolsets, results, messages, streaming
- Existing pages retained: how-agents-work, dependency-injection, error-handling

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- docs/concepts/toolsets.mdx: EXISTS, contains "PreparedToolset"
- docs/concepts/results.mdx: EXISTS, contains "newMessages"
- docs/concepts/messages.mdx: EXISTS, contains "serializeMessages"
- docs/concepts/streaming.mdx: EXISTS, uses "event.kind" (not "event.type" in code)
- docs/docs.json: VALID JSON, contains "concepts/agents" and all 8 new pages
- Commits: ade7aa7, 54c9e94, 0b977cb - all verified in git log
