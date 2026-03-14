# Agent Architecture Patterns from GSD

## 1. ⭐ Thin Orchestrator / Fat Subagent

The orchestrator's job:
> "The orchestrator never does heavy lifting. It spawns agents, waits, integrates results."

Command files are intentionally thin — they define what to do in a few lines, then delegate to workflow files:

```markdown
<process>
Execute the execute-phase workflow from @~/.claude/get-shit-done/workflows/execute-phase.md end-to-end.
Preserve all workflow gates.
</process>
```

The actual logic lives in the workflow file, not the command. Commands are entry points.

**Applicable to vibes:** Main agent orchestrates. Subagents do: README writing, ticket creation, vision drafting, codebase analysis. Main agent stitches, doesn't author.

---

## 2. ⭐ Wave-Based Parallel Execution

Dependencies expressed as wave numbers pre-computed at plan time. At execution time, the orchestrator groups by wave and runs each wave in parallel.

```
Wave 1: [Plan 01, Plan 02] → run in parallel
Wave 2: [Plan 03, Plan 04] → run after Wave 1 completes
Wave 3: [Plan 05] → run after Wave 2 completes
```

**No runtime dependency analysis.** Waves are decided during planning, not execution.

**Applicable to vibes:** Pre-compute what can run in parallel. Example: generate vision and research tech simultaneously (Wave 1), then write README using both (Wave 2).

---

## 3. ⭐ Vertical Slices Over Horizontal Layers

Explicitly documented as the preferred parallelization strategy:

```
PREFER: Plan 01 = User feature (model + API + UI)
        Plan 02 = Product feature (model + API + UI)

AVOID:  Plan 01 = All models
        Plan 02 = All APIs (depends on all models)
        Plan 03 = All UIs (depends on all APIs)
```

**Applicable to vibes:** Generate complete feature slices (vision + requirements + ticket for one feature), not all visions first then all requirements.

---

## 4. ⭐ Analysis Paralysis Guard

Built-in anti-pattern detection in the executor agent:

> "During task execution, if you make 5+ consecutive Read/Grep/Glob calls without any Edit/Write/Bash action: STOP. State in one sentence why you haven't written anything yet. Then either: 1. Write code (you have enough context), or 2. Report 'blocked' with the specific missing information."

**Applicable to vibes:** Add this guard to any agent that needs to explore before generating. Prevents infinite research loops.

---

## 5. ⭐ Checkpoint Protocol

Three checkpoint types:

| Type | Frequency | When |
|---|---|---|
| `human-verify` | 90% | After Claude sets up something needing visual confirmation |
| `decision` | 9% | Implementation choice the user must make |
| `human-action` | 1% | Unavoidable manual step (auth codes, secrets) |

**Automation-first rule:**
> "Users NEVER run CLI commands. Users ONLY visit URLs, click UI, evaluate visuals, provide secrets. Claude does all automation."

When a checkpoint is hit, the agent returns a structured message (not free text) with completed tasks table so a continuation agent doesn't redo work.

**Applicable to vibes:** When generating project artifacts, only stop for genuine decisions. Don't ask the user to run commands.

---

## 6. ⭐ Deviation Rules (Auto-Fix Taxonomy)

| Rule | Trigger | Action |
|---|---|---|
| 1 | Bug found | Auto-fix inline |
| 2 | Missing critical functionality | Auto-add |
| 3 | Blocking issue | Auto-fix |
| 4 | Architectural change needed | STOP, return checkpoint |

Fix attempt limit: 3 auto-fix attempts per task, then document and continue. Prevents infinite fix loops.

**Applicable to vibes:** When generating artifacts, define what the agent can auto-correct (formatting, missing sections) vs. what requires user input (fundamental direction change).

---

## 7. The Agent Roster (for reference)

| Agent | Role |
|---|---|
| `gsd-planner` | Creates PLAN.md from research and user context |
| `gsd-executor` | Executes a PLAN.md, commits per task |
| `gsd-verifier` | Goal-backward verification after execution |
| `gsd-phase-researcher` | Domain research before planning |
| `gsd-project-researcher` | Ecosystem research at project init |
| `gsd-plan-checker` | Pre-execution plan quality audit |
| `gsd-codebase-mapper` | Analyzes existing codebases |
| `gsd-debugger` | Systematic debugging with persistent state |
| `gsd-roadmapper` | Creates ROADMAP.md from requirements |
| `gsd-nyquist-auditor` | Validates test coverage maps to requirements |
