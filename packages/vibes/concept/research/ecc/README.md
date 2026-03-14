# Everything Claude Code (ECC) — Research Report

**Source:** https://github.com/affaan-m/everything-claude-code
**Upstream:** Built by Affaan Mustafa, refined 10+ months of intensive daily use
**Version at research time:** 1.8.0
**Researched:** 2026-03-14
**Applicability:** High — ECC is the most sophisticated Claude Code harness publicly available. Contains patterns directly applicable to vibes agent architecture.

---

## What ECC Is

ECC is a **production-grade Claude Code harness** — a meta-system of agents, skills, commands, hooks, and rules that transforms Claude Code from a chatbot into a configurable, self-improving engineering platform.

**Central insight:** Claude Code is a harness, not just a chatbot. The real leverage comes from treating AI agent behavior as *infrastructure* — configurable, testable, and self-improving — not from writing better prompts session by session.

The key architectural shift: **hooks over skills for enforcement**.
- Skills fire ~50-80% of the time (probabilistic, LLM-driven)
- Hooks fire 100% of the time (deterministic, event-driven)

Any behavior you need guaranteed goes in hooks. Skills are for knowledge and workflows you want Claude to apply contextually.

---

## Files In This Directory

| File | Contents |
|---|---|
| [README.md](./README.md) | This index |
| [philosophy.md](./philosophy.md) | Design philosophy and core principles |
| [agent-architecture.md](./agent-architecture.md) | 16-agent system design and orchestration patterns |
| [skills-system.md](./skills-system.md) | 65+ skills, instinct pipeline, self-improvement |
| [hooks-commands.md](./hooks-commands.md) | Hooks system and slash commands |
| [context-management.md](./context-management.md) | Context window and session continuity patterns |
| [applicable-patterns.md](./applicable-patterns.md) | ⭐ HIGH PRIORITY — what to steal for vibes |

---

## Quick Summary of Key Patterns

### Most Applicable to Vibes

1. **Hooks over skills for enforcement** — Deterministic execution for guaranteed behaviors
2. **Atomic instincts pipeline** — Session learning → confidence scoring → skill evolution
3. **Tiered agent severity** — CRITICAL/HIGH/MEDIUM/LOW with 80% confidence filter
4. **Sequential handoff documents** — Structured context between chained agents
5. **Iterative retrieval pattern** — DISPATCH→EVALUATE→REFINE→LOOP for subagents
6. **Eval-driven development** — Evals as "unit tests of AI behavior," stored alongside code
7. **Project-scoped memory** — Instincts isolated by git remote, promoted to global explicitly

---

## Scale

| Component | Count |
|---|---|
| Agents | 16 |
| Skills | 65+ |
| Commands | 40 |
| Hook event types | 8 |
| MCP server configs | 14 |
| Internal tests | 997 |
| AgentShield rules | 1,282 |

---

## ECC vs GSD

| Dimension | ECC | GSD |
|---|---|---|
| Self-improvement | Core: instinct pipeline learns from sessions | Static rules, manual updates |
| Enforcement model | Hooks (deterministic) + skills (probabilistic) | Skills + rules for all behaviors |
| Eval system | Built-in EDD with pass@k metrics, stored baselines | Not present |
| Autonomous loops | Structured patterns with safety gates | Not present |
| Harness auditing | 70-point quantified scorecard | Not present |
| Project-scoped memory | Yes, promoted to global explicitly | Global only |
| Cross-platform | 4 harnesses (CC, Cursor, Codex, OpenCode) | Claude Code only |
| Model routing | `/model-route` command with budget parameter | Documented in rules, manual |
