# ECC Skills System

## What Skills Are

Skills are `SKILL.md` files containing structured domain knowledge and workflow instructions. They're probabilistic — the LLM decides when to apply them based on context and trigger conditions.

Skills serve as **deep domain knowledge injection**, not enforcement mechanisms. Examples:
- How to write Go table-driven tests (probabilistic knowledge)
- When to use Haiku vs Sonnet vs Opus (model routing guidance)
- How to design PostgreSQL schemas safely (database patterns)

Contrast with hooks (enforcement) and agents (explicit delegation).

---

## Skill File Format

```markdown
---
name: skill-name
description: One-line description of when/why to use
version: 1.0.0
---

## When to Activate
[trigger conditions]

## What's New (v1.0.0)
[changelog]

## Key Phases
[numbered phases of execution]

## Output Format
[what to produce and how]
```

---

## The 65+ Skills — By Category

### Core Workflow
- `tdd-workflow` — Enforces RED→GREEN→REFACTOR with test coverage gates
- `verification-loop` — 6-phase pre-PR quality gate (build → type-check → lint → tests → security-scan → diff-review)
- `search-first` — Research-before-coding: GitHub search, library docs, package registries before any new code
- `eval-harness` — Eval-driven development framework
- `agentic-engineering` — Eval-first execution, autonomous agent operation patterns

### Context Management
- `strategic-compact` — Suggests `/compact` at logical phase boundaries, not mid-implementation
- `iterative-retrieval` — Progressive context narrowing for subagents (DISPATCH→EVALUATE→REFINE→LOOP)
- `continuous-learning-v2` — Session observation → instinct extraction → skill evolution
- `continuous-agent-loop` — Patterns for continuous autonomous loops with quality gates

### Model Routing
- `cost-aware-llm-pipeline` — Model routing by task complexity and budget
  - Haiku 4.5: lightweight agents, frequent invocation, worker agents
  - Sonnet 4.6: main development, orchestration, complex coding
  - Opus 4.6: architectural decisions, maximum reasoning, research

### Language/Framework Patterns
- `golang-patterns` — Idiomatic Go, concurrency, error handling
- `python-patterns` — PEP 8, type hints, Pythonic idioms
- `swiftui-patterns` — State management, @Observable, @Environment
- `kotlin-coroutines-flows` — Coroutines, Flow, Android/KMP patterns
- `django-patterns`, `springboot-patterns`, `kotlin-ktor-patterns` — Framework architectures
- `postgres-patterns`, `clickhouse-io` — Database patterns
- `frontend-patterns` — React, Next.js, state management
- `api-design` — REST design, resource naming, error formats

### Operational
- `enterprise-agent-ops` — Long-lived agent workloads with observability
- `autonomous-loops` — Architecture for autonomous Claude Code loops
- `dmux-workflows` — tmux-based multi-agent orchestration across harnesses
- `agent-harness-construction` — Design and optimize AI agent action spaces
- `loop-operator` (also a skill version) — Loop safety patterns

### Security
- `security-review` — OWASP Top 10, auth handling, API security
- `django-security`, `springboot-security`, `perl-security` — Framework-specific security

### Communication / Content
- `chief-of-staff` — Multi-channel communication triage
- `content-engine` — Platform-native content for X, LinkedIn, newsletters
- `article-writing` — Articles, guides, tutorials
- `investor-materials` — Pitch decks, one-pagers, investor memos

---

## The Instinct Pipeline — ECC's Core Innovation

This is what separates ECC from all other Claude Code setups. Skills are not just written by hand — they're *learned from usage* via an automated pipeline.

### Phase 1: Observation (Hooks)

SessionStart and Stop hooks observe every session. PostToolUse hooks log each tool invocation with context:

```json
{
  "session_id": "abc123",
  "tool": "Edit",
  "file": "src/auth/login.ts",
  "timestamp": "...",
  "context": "..."
}
```

### Phase 2: Pattern Detection (Background Haiku)

A background Haiku agent analyzes observations and detects atomic patterns:

```markdown
---
name: prefer-const-assertions
trigger: When assigning object literals that should not change
confidence: 0.7
project: /path/to/repo
---

Use `as const` assertion for object literals that represent fixed configuration.

Wrong: const config = { port: 3000 }
Right: const config = { port: 3000 } as const
```

### Phase 3: Instinct Files

Each detected pattern becomes an atomic instinct file with:
- `trigger`: when to apply
- `confidence`: 0.3 (tentative) → 0.9 (near-certain)
- `project`: scoped to git repo

### Phase 4: Evolution (`/evolve`)

Clusters related instincts → generates higher-level skills/commands/agents. Three clustering modes:
- **Pattern cluster**: Similar trigger conditions → unified skill
- **Workflow cluster**: Sequential instincts → command or agent
- **Universal cluster**: Appears in 2+ projects with high confidence → candidate for promotion

### Phase 5: Promotion (`/promote`)

Elevates project-scoped instincts to global scope. Requires explicit invocation — never automatic. Creates a review checkpoint before contaminating global scope.

### Confidence System

| Score | Meaning | Application |
|---|---|---|
| 0.3 | Tentative — observed once | Suggested, not enforced |
| 0.5 | Possible — observed 2-3 times | Noted in context |
| 0.7 | Likely — consistent pattern | Applied by default |
| 0.9 | Near-certain — universal | Enforced in reviews |

---

## Key Individual Skills (Deep Dives)

### `strategic-compact`

Solves: context compaction interrupting work mid-task.

Mechanism: PreToolUse hook counts tool invocations. At threshold (default 50), evaluates whether current state is at a phase boundary.

Decision table:
```
Between research → planning:   compact YES
Mid-implementation:            compact NO
After artifact complete:       compact YES
Mid-debugging session:         compact NO
```

Only suggests compaction at natural stopping points where state can be cleanly preserved.

### `iterative-retrieval`

Solves: subagents don't know what context they need before starting.

Four phases (max 3 iterations):
1. **DISPATCH**: Send broad initial query to subagent
2. **EVALUATE**: Score returned context (0.0-1.0 relevance)
   - 0.8-1.0: direct hit
   - 0.5-0.7: related context
   - < 0.2: exclude
3. **REFINE**: If score < 0.7, send narrower follow-up query
4. **LOOP**: Repeat until 3+ high-relevance files found or max iterations reached

Terminates when context quality is sufficient, not when a file count is hit.

### `eval-harness`

Evals as unit tests of AI behavior:

```markdown
## Eval: auth-token-validation

**Prompt:** "Write a function that validates JWT tokens..."

**Pass criteria:**
- Uses asymmetric key verification (not symmetric)
- Checks expiration
- Validates issuer claim
- Returns typed error, not exception

**Metrics:**
- pass@3: at least 1 of 3 attempts passes all criteria
- pass^3: all 3 attempts pass all criteria

**Baseline:** pass@3=0.9, pass^3=0.7 (as of 2026-01-15)
```

Stored in `.claude/evals/` alongside code. Regression detection compares against baselines.

### `continuous-learning-v2`

v2 improvements over v1 (monolithic skill files):
- Atomic instincts (one trigger, one action) over monolithic skills
- Confidence scoring enables graduated application
- Project scoping prevents cross-contamination
- Evolution via clustering creates emergent organization
- Git remote URL as project key enables portability across machines
