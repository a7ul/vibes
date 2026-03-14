# ECC Hooks and Commands System

## Hooks Architecture

**Implementation:** `hooks.json` + Node.js scripts in `scripts/hooks/`

**Philosophy:** Hooks are the enforcement layer. Skills are probabilistic (50-80% fire rate). Hooks fire 100% of the time. Any behavior that must happen belongs in a hook.

---

## 8 Hook Event Types

| Event | Timing | Use Cases |
|---|---|---|
| `PreToolUse` | Before tool execution | Validation, dev server auto-start, compaction suggestions, security checks |
| `PostToolUse` | After tool execution | Auto-format, build checks, pattern observation, PR URL logging |
| `PreCompact` | Before context compaction | State preservation, checkpoint creation |
| `SessionStart` | Conversation start | Load previous context, detect package manager, environment setup |
| `SessionEnd` | Conversation end | Final state persistence |
| `Stop` | After Claude stops responding | Console.log detection, session metrics, pattern extraction |
| `SubagentStart` | When spawning a subagent | Context injection, scope limiting |
| `SubagentStop` | When subagent returns | Result validation, handoff document verification |

---

## Key Hooks (By Event Type)

### PreToolUse Hooks

**Dev server auto-start:**
Detects when Claude is about to make a web request (Bash with curl/fetch patterns, WebFetch) and ensures the dev server is running in a tmux pane. Prevents "connection refused" failures mid-implementation.

**Strategic compaction trigger:**
Counts tool invocations. At threshold (default 50), checks if current state is at a phase boundary. If yes, suggests `/compact`. If mid-implementation, suppresses suggestion.

**Continuous learning observation:**
Logs every tool call with context to the observation buffer. Background Haiku agent processes the buffer asynchronously to avoid slowing down the main session.

**InsAIts security monitoring:**
Pre-execution security scanning. Flags tool calls that match known dangerous patterns (writing to sensitive paths, executing downloaded code, etc.).

**Git push review reminder:**
Before any `git push`, surfaces a checklist: Did you run the verification loop? Is the PR description drafted? Are secrets excluded from the diff?

**Documentation file warnings:**
Before editing certain file types (CHANGELOG.md, CONTRIBUTING.md, LICENSE), surfaces a warning that these are human-authored and should be modified carefully.

### PostToolUse Hooks

**PR URL logging:**
After `gh pr create`, captures and logs the PR URL to a session-persistent file. Prevents "what was the PR URL again?" after compact.

**Async build analysis:**
After file edits to TypeScript/Go/etc., triggers an async build check in a background process. Results are surfaced next time Claude takes an action (not inline — avoids interrupting flow).

**Quality gate checks:**
After file writes, checks if the file is in a tested module. If yes, suggests running the relevant test suite before proceeding.

**JS/TS auto-format:**
After editing `.ts`, `.tsx`, `.js`, `.jsx` files, runs `prettier --write` on the modified file.

**TypeScript type checking:**
After editing `.ts`/`.tsx`, runs `tsc --noEmit` and surfaces type errors immediately.

**console.log warnings:**
After editing any JS/TS file, scans for `console.log` statements and notes them (not errors — just surfaced).

**Learning result capture:**
After the background Haiku instinct-detection agent completes, captures any new instincts and updates the instinct store.

### Stop Hooks

**Session state persistence:**
Writes current session state to `~/.claude/sessions/{repo-hash}/latest.md`. Includes: what was worked on, modified files, open questions, next steps.

**Pattern extraction evaluation:**
Triggers the instinct pipeline: exports observation buffer → Haiku analysis → instinct file creation.

**Token/cost metrics:**
Logs total tokens used, estimated cost, tool call count, and session duration to `~/.claude/metrics/`.

**console.log detection:**
Final scan for console.log statements across all modified files in the session. Surfaced in session summary.

### SessionStart Hooks

**Previous context load:**
Reads `~/.claude/sessions/{repo-hash}/latest.md` and injects it into the session context as a formatted reminder block.

**Package manager detection:**
Detects npm/yarn/pnpm/bun by lockfile presence. Sets `ECC_PKG_MANAGER` environment variable used by other hooks.

---

## Hook Profiles

Runtime-configurable via `ECC_HOOK_PROFILE` environment variable:

| Profile | Description |
|---|---|
| `minimal` | SessionStart/Stop only. No inline quality checks. Fastest. |
| `standard` | Core quality gates + learning. Default. |
| `strict` | All hooks enabled including async build checks and full security monitoring. |

Individual hooks disabled via `ECC_DISABLED_HOOKS=hook1,hook2,...`.

---

## 40 Commands (Slash Commands)

Commands are user-invoked, explicitly intentional. They coordinate multi-step workflows that benefit from human initiation.

### Workflow Commands

| Command | Description |
|---|---|
| `/tdd` | Enforces RED→GREEN→REFACTOR, invokes tdd-guide agent |
| `/plan` | Invokes planner agent, produces planning docs |
| `/orchestrate [mode]` | Sequential agent workflow: feature/bugfix/refactor/security |
| `/verify` | Runs 6-phase verification loop (pre-PR gate) |
| `/multi-workflow` | Multi-model: Claude + Codex + Gemini collaboration |

### Instinct / Memory Commands

| Command | Description |
|---|---|
| `/learn` | Extract session patterns into skill files (`~/.claude/skills/learned/`) |
| `/instinct-status` | Show learned instincts with confidence bars |
| `/evolve` | Cluster instincts → generate skills/commands/agents |
| `/instinct-export` | Export instincts to file for sharing |
| `/instinct-import` | Import instincts from file or URL |
| `/promote` | Elevate project-scoped instincts to global scope |
| `/projects` | List all known projects and their instinct counts |
| `/skill-create` | Analyze git history → generate SKILL.md |

### Harness Commands

| Command | Description |
|---|---|
| `/harness-audit` | Score harness across 7 dimensions (70-point scorecard) |
| `/model-route` | Recommend Haiku/Sonnet/Opus based on task + budget |
| `/configure-ecc` | Interactive installer (41 skills, 8 categories) |

### Loop Commands

| Command | Description |
|---|---|
| `/loop-start [pattern] [--mode]` | Start autonomous loop (sequential/continuous-pr/rfc-dag/infinite) |
| `/checkpoint [create\|verify\|list\|clear]` | Workflow state snapshots with git integration |

### Utility Commands

| Command | Description |
|---|---|
| `/claw` | NanoClaw v2 — persistent markdown conversation history with branching |
| `/aside` | Answer quick side question without interrupting current flow |
| `/security-scan` | Scan Claude configuration for security issues (AgentShield) |

---

## The Orchestrate Command (Deep Dive)

The `/orchestrate` command is ECC's most sophisticated workflow. It chains agents with structured handoff documents.

**Feature mode:**
```
planner → tdd-guide → code-reviewer → security-reviewer
```

1. **planner**: Produces PLAN.md with phases, risks, dependencies
2. **tdd-guide**: Writes tests first, implements to pass, produces coverage report
3. **code-reviewer**: Reviews all modified files, produces severity-tiered report
4. **security-reviewer**: Scans for vulnerabilities, produces security report

**Final output:** ORCHESTRATION-REPORT.md containing:
- Summary of what was built
- Test coverage achieved
- Code review findings (CRITICAL/HIGH only)
- Security findings
- SHIP / NEEDS WORK / BLOCKED verdict
- Open questions for human review

**Handoff format between agents:**
```markdown
## Handoff: planner → tdd-guide

**Phase Summary:** [planner output]
**Files to Create:** [list]
**Files to Modify:** [list]
**Open Questions:** [list]
**tdd-guide Instructions:** [specific guidance for next agent]
```

---

## NanoClaw v2 (Claw) — Deep Dive

A persistent, branching conversation tool implemented as zero-dependency Node.js.

**Storage:** `~/.claude/claw/` as markdown files

**Features:**
- `/branch` — Fork the current conversation thread
- `/compact` — Summarize conversation, continue with summary as context
- Search across sessions
- Multiple export formats (markdown, JSON, HTML)
- Session history navigation

**Use case:** Long research conversations that need to be resumed, branched, or shared. Claw is the answer to "I had this conversation with Claude a week ago that I need to find and continue."
