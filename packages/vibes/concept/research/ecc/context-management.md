# ECC Context Management

## The Problem

Claude degrades as context fills. ECC addresses this at three levels:
1. **Prevention** — Don't fill context unnecessarily
2. **Management** — Control when and what gets compacted
3. **Recovery** — Resume cleanly after compaction or session end

---

## Context Degradation Model

Same as GSD's model (both learned this from experience):

| Context Usage | Quality |
|---|---|
| 0–30% | PEAK |
| 30–50% | GOOD |
| 50–70% | DEGRADING |
| 70%+ | POOR |

ECC's rules state: avoid the last 20% for large-scale refactoring, feature implementation spanning multiple files, or debugging complex interactions.

---

## Prevention: Don't Fill Context Unnecessarily

### Iterative Retrieval Pattern

Subagents don't know what context they need before starting. Naive approach: send everything. ECC's approach: progressive narrowing.

```
DISPATCH (broad query)
  ↓
EVALUATE (score results 0.0-1.0)
  ↓ if score < 0.7
REFINE (narrower query)
  ↓ if score >= 0.7 with 3+ files
COMPLETE
```

Relevance scoring:
- 0.8-1.0: direct hit — include
- 0.5-0.7: related — include with lower weight
- 0.3-0.5: tangential — include only if no better options
- < 0.2: exclude

Max 3 iterations. Terminates when quality is sufficient, not when a count is hit.

### Model Routing

Using the right model means less context wasted on model overhead:

```
Haiku 4.5   → Lightweight agents, frequent invocation, worker agents in multi-agent systems
Sonnet 4.6  → Main development, orchestrating multi-agent workflows, complex coding
Opus 4.6    → Architectural decisions, maximum reasoning, research
```

`/model-route [task description] [--budget low|medium|high]` returns a recommendation with justification.

---

## Management: Control Compaction

### Strategic Compact Skill

**Problem:** Auto-compaction triggers at arbitrary points — often mid-implementation, losing critical context.

**Solution:** PreToolUse hook counts tool invocations. At threshold (default 50), evaluates phase boundary status.

Decision table:
```
Transition state              → Compact YES
  (between research→planning, after artifact complete)

Active state                  → Compact NO
  (mid-implementation, mid-debugging, mid-refactor)
```

The key question: "Is the current work at a clean stopping point where state can be fully preserved in a summary?"

### TodoWrite as Context Anchor

Explicitly recommended: task state written to disk via TodoWrite survives compaction. Tasks are reloaded from disk, not from context.

Pattern: Before any risky compaction point, ensure all in-progress work is represented as TodoWrite items with enough context to resume.

---

## Recovery: Session Continuity

### Session State Persistence (Stop Hooks)

After every session, Stop hooks write:

```markdown
# Session State: {repo-name}
**Date:** 2026-03-14
**Duration:** 47 minutes
**Tokens used:** 142,847

## What Was Worked On
- Implemented JWT validation in auth/token.ts
- Fixed race condition in cache/manager.ts

## Modified Files
- src/auth/token.ts
- src/cache/manager.ts
- tests/auth/token.test.ts

## Open Questions
- Should we refresh tokens automatically or require re-auth?
- Cache invalidation strategy for distributed deployments?

## Next Steps
1. Add refresh token rotation
2. Write integration tests for token expiry edge cases
```

### Session Reload (SessionStart Hooks)

SessionStart hooks read the state file and inject it as a formatted block:

```markdown
**Previous Session Context (2026-03-14):**
Worked on JWT validation. Modified: auth/token.ts, cache/manager.ts.
Next: refresh token rotation + integration tests.
Open Q: auto-refresh vs re-auth?
```

This creates working memory across conversations without relying on the user to re-explain.

### Checkpoint System (`/checkpoint`)

More granular than session state. Creates recoverable snapshots at:
- Phase boundaries during long implementations
- Before risky operations
- After completing logical units of work

Checkpoint format:
```markdown
# Checkpoint: auth-implementation-phase-2
**Created:** 2026-03-14T15:30:00Z
**Git SHA:** abc1234
**Verified:** build passes, tests pass

## State
Phase 1 complete: token validation
Phase 2 in progress: refresh token rotation (50% done)

## To Resume
Read: src/auth/refresh.ts (partial implementation)
Next action: implement token rotation in refreshToken()
```

`/checkpoint verify` confirms the checkpoint is still valid (git state matches, files unchanged).

---

## Context Scoping: The Contexts Directory

`contexts/` directory contains mode files that activate different behavioral profiles:

**`dev.md`:**
- Code first, explain after
- Working solution over perfect solution
- Inline comments only for non-obvious logic
- Prefer reading existing code over asking about it

**`research.md`:**
- Cite sources explicitly
- Flag LOW confidence findings
- Prefer official docs over inference
- Return structured findings, not prose

**`review.md`:**
- Report issues at severity level, not length of discussion
- 80% confidence filter before reporting
- Focus on correctness over style
- Provide concrete fixes, not recommendations

These can be activated per-session or set as defaults.

---

## The Orchestrator Context Budget

ECC's orchestrate command keeps the orchestrator's context lean:

```
Orchestrator uses ~15-20% context
  → Spawns planner subagent (fresh context)
    → Returns PLAN.md (structured artifact)
  → Spawns tdd-guide subagent (fresh context)
    → Returns coverage report (structured artifact)
  → Spawns code-reviewer subagent (fresh context)
    → Returns severity-tiered report (structured artifact)
```

The orchestrator reads only the structured headers of each returned artifact to determine next action — not the full content. This is the "read the header, not the body" pattern for context efficiency.
