# Context Engineering Techniques from GSD

## 1. ⭐ Context Budget Preservation

The orchestrator explicitly budgets its own context usage.

> "Context budget: ~15% orchestrator, 100% fresh per subagent."

Every heavy-lifting stage (research, planning, execution, verification) is delegated to subagents that get a fresh 200K context window. The orchestrator only coordinates — it never does deep work itself.

**Applicable to vibes:** The main vibes agent should stay lean. Delegate README generation, ticket writing, and vision drafting to subagents with fresh contexts.

---

## 2. ⭐ Context Propagation Chain

Each artifact is a context handoff to the next stage. Downstream agents are not re-asked questions.

```
PROJECT.md (vision, always loaded)
    ↓
REQUIREMENTS.md (scoped features)
    ↓
ROADMAP.md (phases + success criteria)
    ↓
CONTEXT.md (user decisions — locked, non-negotiable)
    ↓
RESEARCH.md (technical knowledge for this phase)
    ↓
PLAN.md (executable tasks with XML structure)
    ↓
SUMMARY.md (what happened, committed)
    ↓
VERIFICATION.md (did it actually work?)
```

**Applicable to vibes:** When building project artifacts, establish a clear chain. Vision → Requirements → Tickets → README. Each stage reads the previous, doesn't re-invent.

---

## 3. ⭐ `<files_to_read>` Injection Pattern

The orchestrator constructs what context each subagent receives dynamically. Subagents do not load arbitrary files — they get a curated list.

```xml
<files_to_read>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@src/path/to/relevant.ts
</files_to_read>
```

Agents have a mandatory rule:
> "If the prompt contains a `<files_to_read>` block, you MUST use the Read tool to load every file listed there before performing any other actions."

**Applicable to vibes:** When spawning a README-writing subagent, explicitly tell it which files to read (vision, requirements, codebase summary). Don't let it go hunting.

---

## 4. ⭐ STATE.md — Size-Constrained Living Memory

STATE.md is deliberately **under 100 lines**. It is read at the start of every workflow and contains:

- Current position (phase X, plan Y)
- Visual progress bar
- Recent decisions (last 3–5, full log in PROJECT.md)
- Blockers/concerns
- Session continuity pointer

**Key insight:** A single small file that's always read beats a rich system that's too large to consume quickly.

**Applicable to vibes:** Keep a `state.md` or equivalent that the main agent always reads at start. Under 100 lines. Pointer to larger context, not the context itself.

---

## 5. ⭐ Selective Context Loading

Every agent follows this pattern:

1. List available skills (lightweight index)
2. Read SKILL.md for each skill (~130 lines max)
3. Load specific detail files only as needed
4. Do NOT load full AGENTS.md files (100KB+ context cost)

The SKILL.md is a summary/index, not the full spec. Agents load detail only when needed.

**Applicable to vibes:** Agent system prompts should be indices pointing to detail, not monolithic specs loaded every time.

---

## 6. ⭐ Canonical References Section

In CONTEXT.md, a mandatory section listing all spec/ADR/design docs with full paths.

> "Inline mentions like 'see ADR-019' are useless — downstream agents need full paths in a dedicated section they can find."

```markdown
## Canonical References
- Vision: @.planning/PROJECT.md
- Requirements: @.planning/REQUIREMENTS.md
- API spec: @docs/api/openapi.yaml
```

**Applicable to vibes:** Every document produced should include a canonical references section with full paths, not short-hand references.

---

## 7. Confidence Levels in Research

Research agents assign confidence to every finding:

| Level | Sources | Usage |
|---|---|---|
| HIGH | Context7, official docs, official releases | State as fact |
| MEDIUM | WebSearch verified with official source | State with attribution |
| LOW | WebSearch only, single source | Flag as needing validation |

**Tool priority order:** Context7 → WebFetch official docs → WebSearch → nothing

Claude's training data is treated as "hypothesis, not fact" — 6–18 months stale.

**Applicable to vibes:** When researching a project's ecosystem, use this confidence scheme. Mark LOW-confidence findings explicitly.
