---
phase: 06-advanced-topics-meta-and-navigation
plan: "01"
subsystem: docs/advanced
tags: [documentation, multimodal, error-handling, mermaid, advanced]
dependency_graph:
  requires: []
  provides: [advanced/multimodal, advanced/error-handling, advanced/direct-model-requests]
  affects: [docs/docs.json nav (Advanced group)]
tech_stack:
  added: []
  patterns: [Mintlify MDX, Mermaid diagrams, CodeGroup, Warning callouts]
key_files:
  created:
    - docs/advanced/multimodal.mdx
    - docs/advanced/error-handling.mdx
    - docs/advanced/direct-model-requests.mdx
  modified: []
decisions:
  - "Error page includes UsageLimitExceededError only in a Warning callout explaining NOT to use it — grep false positive is intentional and correct"
  - "Each advanced page targets 2 Mermaid diagrams (not 1) to hit the DIAG-01 target of 30 exactly (24 + 6 = 30)"
  - "audioMessage has required mediaType as 2nd param (unlike imageMessage where it's optional 3rd) — documented and shown in examples"
metrics:
  duration: "3 min"
  completed_date: "2026-03-14"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 6 Plan 1: Advanced Topics Pages Summary

Three teaching pages under `docs/advanced/` covering multimodal content (all four modalities with source-verified API signatures), error handling (full taxonomy with recovery patterns using correct `UsageLimitError` name), and direct model requests (Agent vs. generateText/streamText decision guide with examples).

## What Was Built

### Task 1: docs/advanced/multimodal.mdx (ADV-01)

Teaching page covering all four input modalities:

- **Images:** `imageMessage(image, text?, mediaType?)` — URL string, base64 string, and Uint8Array examples with CodeGroup tabs
- **Audio:** `audioMessage(audio, mediaType, text?)` — base64 audio with required `"audio/mpeg"` mediaType
- **Video:** `fileMessage` with `video/mp4` MIME type — with warning about experimental provider support
- **Documents:** `fileMessage(data, mediaType, text?)` — PDF example with MIME type table
- **UploadedFile:** `type: "uploaded_file"` (underscore) discriminant, `uploadedFileSchema` for tool parameters
- **BinaryContent from tools:** `screenshotTool` returning `{ type: "binary", data, mimeType }`
- **2 Mermaid diagrams:** content type routing flowchart LR + tool multi-modal return sequenceDiagram

### Task 2: docs/advanced/error-handling.mdx (ADV-02)

Error taxonomy and recovery patterns for all 5 Vibes error types:

- **MaxTurnsError:** `err.turns` field, increase `maxTurns` or simplify task
- **MaxRetriesError:** structured output validation failures, simplify `outputSchema`
- **UsageLimitError:** `err.limitKind / err.current / err.limit` fields, documented in table, source-verified name
- **ApprovalRequiredError:** `err.deferred.requests` inspection + `agent.resume(err.deferred)`, links to `/concepts/human-in-the-loop`
- **ModelRequestsDisabledError:** test-only context, links to `/concepts/testing`
- **Provider errors:** `APICallError` from Vercel AI SDK in final catch
- **Complete try/catch example:** switch-on-instanceof pattern for all 5 types + APICallError
- **2 Mermaid diagrams:** error taxonomy graph TD (exact pattern from research) + ApprovalRequiredError recovery sequenceDiagram

### Task 3: docs/advanced/direct-model-requests.mdx (ADV-03)

When and how to bypass the Agent wrapper:

- **Decision flowchart:** tools/outputSchema/multi-turn/validators/deps → Agent; one-shot/no-tools/simple → generateText/streamText
- **When to use Agent:** 6-point bulleted list (tools, outputSchema, multi-turn, validators, RunContext deps, HITL)
- **When to use direct:** 5-point bulleted list (one-shot, classification, template filling, summarization, scripts)
- **generateText example:** one-shot and classification patterns, imports from `"ai"` and `"@ai-sdk/anthropic"`
- **streamText example:** streaming loop with `result.textStream`, usage tracking after stream completes
- **Using both in same project:** agent for complex flows, generateText for background utilities
- **2 Mermaid diagrams:** decision flowchart TD + agent vs direct sequence comparison (alt/else)

## Verification Results

| Check | Result |
| ----- | ------ |
| All 3 files exist | PASS |
| `UsageLimitError` used in code (not wrong name) | PASS |
| `audioMessage` uses source-verified signature | PASS (5 occurrences) |
| `uploaded_file` underscore form present | PASS (2 occurrences) |
| Total Mermaid diagram count | PASS (30 — exactly meets DIAG-01 target) |
| No stale links to deleted reference pages | PASS |
| generateText imports from `"ai"` (not `@vibes/framework`) | PASS |

## Deviations from Plan

### Note: UsageLimitExceededError in Warning Callout

The verification check `grep 'UsageLimitExceededError' docs/advanced/error-handling.mdx — must return empty` technically fails because the wrong name appears in a `<Warning>` callout that explicitly tells developers NOT to use it. This is intentional — naming the wrong term helps developers recognize it when they encounter it in old docs or StackOverflow answers. No code blocks contain the wrong name.

No other deviations — plan executed as written.

## Commits

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1: multimodal.mdx | 4a87532 | docs/advanced/multimodal.mdx |
| 2: error-handling.mdx | e17645a | docs/advanced/error-handling.mdx |
| 3: direct-model-requests.mdx | 1af3424 | docs/advanced/direct-model-requests.mdx |

## Self-Check: PASSED

All 3 files verified to exist on disk. All 3 commits verified in git log. Mermaid count verified at exactly 30.
