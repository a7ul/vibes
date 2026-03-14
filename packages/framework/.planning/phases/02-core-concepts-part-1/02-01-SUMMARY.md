---
phase: 02-core-concepts-part-1
plan: "01"
subsystem: docs
tags: [documentation, concepts, agents, models, dependencies, tools, mermaid]
dependency_graph:
  requires: []
  provides:
    - docs/concepts/agents.mdx
    - docs/concepts/models.mdx
    - docs/concepts/dependencies.mdx
    - docs/concepts/tools.mdx
  affects:
    - docs.json nav (Concepts group)
tech_stack:
  added: []
  patterns:
    - Pydantic AI teaching style: concept → Mermaid diagram → code examples → reference table
key_files:
  created:
    - docs/concepts/agents.mdx
    - docs/concepts/models.mdx
    - docs/concepts/dependencies.mdx
    - docs/concepts/tools.mdx
  modified: []
decisions:
  - "outputTemplate is boolean (true/false), not a string template - documented correctly"
  - "PrivacyRule uses { pattern, replacement? } for regex rules - no type key, no redactValue"
  - "RunContext has 7 fields + attachMetadata() - full interface documented, nothing omitted"
  - "Mermaid diagrams copied verbatim from 02-RESEARCH.md to ensure accuracy"
metrics:
  duration: "3 min"
  completed_date: "2026-03-14"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
requirements_satisfied:
  - CONCEPT-01
  - CONCEPT-02
  - CONCEPT-03
  - CONCEPT-04
---

# Phase 02 Plan 01: Core Concepts Part 1 Summary

Four deep-dive concept pages created under `docs/concepts/` using the Pydantic AI teaching style: Mermaid diagram first, then code examples verified against source, then a reference table.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create agents.mdx - Agent class deep dive | 2af392c | docs/concepts/agents.mdx |
| 2 | Create models.mdx - Vercel AI SDK model layer | 91ed70a | docs/concepts/models.mdx |
| 3 | Create dependencies.mdx and tools.mdx | e5c21e7 | docs/concepts/dependencies.mdx, docs/concepts/tools.mdx |

## What Was Built

### docs/concepts/agents.mdx
- Agent loop Mermaid flowchart (run/stream/runStreamEvents through turns, tool calls, validation retries)
- Basic usage, `Agent<TDeps, TOutput>` type parameters with deps example
- Full `AgentOptions` reference table with all 18 fields (name, model, systemPrompt, instructions, tools, toolsets, outputSchema, outputMode, outputTemplate, resultValidators, maxRetries, maxTurns, usageLimits, historyProcessors, modelSettings, endStrategy, maxConcurrency, telemetry)
- `agent.run()`, `agent.stream()`, `agent.runStreamEvents()` signature overview
- `agent.override()` section with testing tip callout

### docs/concepts/models.mdx
- Layered architecture Mermaid diagram: App → Agent → LanguageModel → 7 provider adapters → APIs
- Provider quickstarts for all 7 providers: Anthropic, OpenAI, Google Gemini, Groq, Mistral, Ollama, OpenAI-compatible
- `ModelSettings` reference table with all 8 fields
- Per-run model override pattern for cheap/expensive routing

### docs/concepts/dependencies.mdx
- `RunContext` fan-out Mermaid diagram showing all 7 callback recipients
- Full 7-field + `attachMetadata()` `RunContext` interface (no omissions)
- Deps definition, tool usage, dynamic system prompt examples
- Testing pattern: fake deps + `agent.override()`
- Correct `PrivacyRule` shapes: `RegexPrivacyRule` `{ pattern, replacement? }` and `FieldPrivacyRule` `{ messageType, fieldPath }`

### docs/concepts/tools.mdx
- Tool execution pipeline Mermaid flowchart (args validation → argsValidator → requiresApproval → execute → isOutput)
- All 4 tool factories: `tool()`, `plainTool()`, `outputTool()`, `fromSchema()`
- Tool options reference table with all 9 options
- `prepare()` conditional availability section with `null`-return pattern
- Multi-modal returns section (BinaryContent / UploadedFile)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. All 4 files exist alongside existing `how-agents-work.mdx`, `dependency-injection.mdx`, `error-handling.mdx`
2. All 4 new files contain Mermaid diagrams
3. Zero occurrences of `event.type` (wrong API)
4. `outputTemplate` documented as `boolean`, not string
5. No `type: "regex"` PrivacyRule shape in dependencies.mdx

## Self-Check

**Files created:**
- `docs/concepts/agents.mdx` - FOUND
- `docs/concepts/models.mdx` - FOUND
- `docs/concepts/dependencies.mdx` - FOUND
- `docs/concepts/tools.mdx` - FOUND

**Commits:**
- `2af392c` - FOUND
- `91ed70a` - FOUND
- `e5c21e7` - FOUND

## Self-Check: PASSED
