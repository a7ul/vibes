# GSD (Get Shit Done) — Context Engineering Research

**Source:** https://github.com/gsd-build/get-shit-done
**Researched:** 2026-03-14
**Applicability:** High — patterns directly applicable to vibes agent for building projects, READMEs, tickets, visions

---

## What GSD Is

GSD is a **meta-prompting and context engineering system** installed on top of Claude Code. It is not runtime code — it is a collection of Markdown files that Claude reads as instructions. The install script places these files in `~/.claude/commands/gsd/`, `~/.claude/agents/`, and `~/.claude/get-shit-done/`.

**Central insight:** Claude degrades as context fills up. GSD's entire architecture fights this — keeping the orchestrator context lean while spawning fresh subagent contexts for heavy work.

---

## Files In This Directory

| File | Contents |
|---|---|
| [README.md](./README.md) | This index |
| [context-engineering.md](./context-engineering.md) | Context management techniques |
| [agent-architecture.md](./agent-architecture.md) | Agent design patterns |
| [prompt-patterns.md](./prompt-patterns.md) | Prompt and XML task patterns |
| [structured-outputs.md](./structured-outputs.md) | Artifact formats (PROJECT.md, PLAN.md, etc.) |
| [state-management.md](./state-management.md) | State and session continuity patterns |
| [philosophy.md](./philosophy.md) | Design philosophy and principles |
| [applicable-patterns.md](./applicable-patterns.md) | ⭐ HIGH PRIORITY — what to steal for vibes |

---

## Quick Summary of Key Patterns

### Most Applicable to Vibes

1. **Context Propagation Chain** — Each artifact carries exactly what downstream stages need
2. **Decision Lock Pattern** — CONTEXT.md with Decisions/Discretion/Deferred sections
3. **Thin Orchestrator / Fresh Subagent** — Orchestrator uses ~15% context, delegates rest
4. **Goal-Backward Verification** — Did we achieve the goal, not just complete the tasks?
5. **Questioning Guide** — "Dream extraction, not requirements gathering"
6. **STATE.md under 100 lines** — Living memory deliberately size-constrained

---

## Context Degradation Model

| Context Usage | Quality |
|---|---|
| 0–30% | PEAK |
| 30–50% | GOOD |
| 50–70% | DEGRADING |
| 70%+ | POOR |

Rule: Each plan should complete within ~50% context usage.
