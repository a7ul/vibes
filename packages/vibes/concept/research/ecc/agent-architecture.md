# ECC Agent Architecture

## Agent Definition Format

Agents are Markdown files with YAML frontmatter:

```yaml
---
name: loop-operator
description: Operate autonomous agent loops...
tools: ["Read", "Grep", "Glob", "Bash", "Edit"]
model: sonnet
color: orange
---
```

Agent body contains role, responsibilities, behavioral rules, output format, and when to activate.

---

## The 16 Agents

### Development Agents

| Agent | Purpose | Key Behavior |
|---|---|---|
| `planner` | Implementation planning | Phased breakdown, risk identification, produces planning docs (PRD, arch, system_design, tech_doc, task_list) |
| `architect` | System design | Scalability, technical decision-making, architectural trade-off analysis |
| `tdd-guide` | Test-driven development | Enforces RED→GREEN→REFACTOR strictly, invokes before implementation begins |
| `code-reviewer` | Code review | Tiered severity (CRITICAL/HIGH/MEDIUM/LOW), 80% confidence filter before reporting |
| `security-reviewer` | Vulnerability detection | OWASP Top 10, secrets, injection, SSRF — mandatory before commits |
| `build-error-resolver` | Fix build errors | Incremental fix cycles, Go/TS/Kotlin variants |
| `e2e-runner` | E2E testing | Playwright automation, manages test journeys, quarantines flaky tests |
| `refactor-cleaner` | Dead code cleanup | Runs knip/depcheck/ts-prune, safely removes dead code |
| `doc-updater` | Documentation | Updates codemaps, runs /update-codemaps and /update-docs |

### Language-Specific Review Agents

| Agent | Language |
|---|---|
| `go-reviewer` | Go — idiomatic patterns, concurrency, error handling |
| `python-reviewer` | Python — PEP 8, type hints, security, performance |
| `kotlin-reviewer` | Kotlin — coroutine safety, Compose, clean architecture |
| `database-reviewer` | PostgreSQL/Supabase — query optimization, schema design, security |

### Operational Agents

| Agent | Purpose | Innovation |
|---|---|---|
| `loop-operator` | Monitors autonomous loops | Detects stalls, retry storms; intervenes safely |
| `harness-optimizer` | Audits ECC configuration | Scores 7 dimensions 0-10, improves incrementally |
| `chief-of-staff` | Multi-channel communication | Classifies email/Slack/LINE/Messenger into 4 tiers deterministically |

---

## Orchestration Patterns

### 1. Proactive Delegation

Agents fire automatically based on task type without user prompting. The rules files instruct Claude to invoke specific agents immediately on certain conditions:

```
Complex feature requests → use planner agent
Code just written/modified → use code-reviewer agent
Bug fix or new feature → use tdd-guide agent
Build fails → use build-error-resolver agent
```

No user prompt needed.

### 2. Sequential Handoff via Documents

The `/orchestrate` command chains agents. Each produces a structured handoff document:

```markdown
## Handoff: [agent-name] → [next-agent]

**Findings:**
- ...

**Modified Files:**
- ...

**Open Questions:**
- ...

**Recommendations:**
- ...
```

Final report includes a SHIP / NEEDS WORK / BLOCKED verdict.

**Orchestration modes:**
- `feature` — planner → tdd-guide → code-reviewer → security-reviewer
- `bugfix` — tdd-guide → code-reviewer → verification-loop
- `refactor` — refactor-cleaner → code-reviewer → doc-updater
- `security` — security-reviewer → code-reviewer

### 3. Parallel Execution

Multiple agents launched simultaneously for independent work. ECC's rules explicitly instruct: "ALWAYS use parallel Task execution for independent operations."

### 4. Worktree Orchestration

`orchestrate-worktrees.js` manages separate git worktrees across tmux panes. Each agent gets:
- Isolated git state (separate worktree)
- Dedicated tmux pane
- True parallelism without merge conflicts until merge phase

### 5. Multi-Model Collaboration

`/multi-workflow` command: Claude as orchestrator, Codex as backend authority, Gemini as frontend expert.

Rules:
- External models have zero filesystem write access
- All writes flow through Claude
- Sessions reused across phases via session IDs to preserve context
- 6-phase structure: Research → Ideation → Plan → Execute → Optimize → Review

---

## Code Reviewer Design (Deep Dive)

The 80% confidence filter is a key ECC innovation:

```
Report CRITICAL: Code that will definitely cause data loss, security breach, or crash in production
Report HIGH: Code that is probably broken or dangerous
Report MEDIUM: Code that may be problematic
Skip LOW: Stylistic issues, minor optimizations, opinions
```

Filter: **Only report if confidence > 80%**. Below that threshold, do not mention the issue. This prevents noise from drowning signal — the reviewer's output is actionable, not a wall of warnings.

Output format:
```markdown
## [CRITICAL] SQL Injection — auth/login.ts:47
**Issue:** User input directly interpolated into query string
**Fix:** Use parameterized queries
**Confidence:** 95%
```

---

## Loop Operator Design (Deep Dive)

Autonomous loop management is ECC's answer to "how do you run Claude without babysitting it?"

**Required pre-conditions before starting any loop:**
1. Work in isolated branch (never main)
2. Use git worktree for filesystem isolation
3. Define explicit success criteria
4. Set loop budget (max iterations/tokens)

**During loop execution:**
- Stall detection: X retries with same error → escalate
- Retry storm detection: pattern of rapid retries → pause and analyze
- Quality gate enforcement at each iteration boundary
- Progress logging to disk (survives crashes)

**Loop modes:**

| Mode | Description |
|---|---|
| `sequential` | Execute tasks in order, stop on any failure |
| `continuous-pr` | Continuous integration loop: code → review → fix → PR |
| `rfc-dag` | RFC-driven: parse requirements as DAG, execute in dependency order |
| `infinite` | Production monitoring loop with escalation protocols |

---

## Chief of Staff Design (Deep Dive)

The most unusual agent — it treats communication channels as a software system:

**4-tier classification:**
1. `skip` — Notifications, newsletters, FYIs requiring no action
2. `info_only` — Read and acknowledge, no response needed
3. `meeting_info` — Extract calendar details, create event
4. `action_required` — Requires a response or task

**Why hooks enforce post-send checklists:** "LLMs forget instructions ~20% of the time." The PostToolUse hook on message-send tools runs a mandatory checklist regardless of what the LLM decided.

Channels handled: Email (Gmail), Slack, LINE, Messenger.
