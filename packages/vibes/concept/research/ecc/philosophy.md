# ECC Design Philosophy

## 1. The Harness-First Paradigm

> "Claude Code is a harness, not just a chatbot."

ECC's foundational claim: the real leverage in AI-assisted development isn't better prompts. It's treating agent behavior as infrastructure — configurable, testable, measurable, and self-improving.

This reframes the question from "how do I get Claude to do X?" to "how do I build a system where X always happens correctly?"

**Implications:**
- Quality gates run regardless of Claude's judgment (hooks)
- Workflows are encoded in the system, not re-explained each session
- Behavior is measured (harness audit scorecard) and improved iteratively

---

## 2. Determinism Over Probability

**The core tension:**
- LLM behavior is probabilistic. Skills fire ~50-80% of the time.
- Production systems need guarantees.

ECC's solution: separate the guaranteed behaviors (hooks) from the probabilistic behaviors (skills).

```
Guaranteed behaviors    → Hooks (PreToolUse, PostToolUse, Stop, SessionStart)
Contextual behaviors    → Skills (domain knowledge, workflows)
User-invoked behaviors  → Commands (explicit orchestration)
```

Never put a behavior in a skill if it needs to happen every time. Never put a behavior in a hook if it only needs to happen sometimes.

---

## 3. Systems Are Self-Improving

> The more you use it, the better it gets.

GSD is static — rules are written once, manually updated. ECC's instinct pipeline continuously extracts patterns from sessions:

```
Session hooks observe every tool call
  → Background Haiku agent detects patterns
    → Atomic instinct files with confidence scores
      → /evolve clusters instincts
        → Skills/commands/agents generated from clusters
          → /promote elevates cross-project patterns globally
```

Confidence scores (0.3 tentative → 0.9 near-certain) modulate how aggressively instincts are applied. This creates a flywheel: early use is generic, extended use becomes deeply personalized.

---

## 4. Measurability Over Feel

ECC quantifies what GSD hand-waves:

**Harness quality** — 70-point scorecard (7 dimensions × 10 points):
1. Tool Coverage
2. Context Efficiency
3. Quality Gates
4. Memory Persistence
5. Eval Coverage
6. Security Guardrails
7. Cost Efficiency

**AI behavior quality** — Eval-driven development (EDD):
- pass@k: at least one success in k attempts
- pass^k: all k attempts succeed
- Baseline snapshots for regression detection

**Session cost** — Token/cost metrics tracked per session via Stop hooks

This shifts from "Claude seems to be getting better" to "our harness scores 58/70, specifically weak on Eval Coverage."

---

## 5. Hierarchy of Trust

ECC has an explicit trust hierarchy for behaviors:

```
Hooks (PreToolUse/PostToolUse) — unconditional enforcement
Commands (user-invoked)        — explicit, intentional orchestration
Agents (auto-triggered)        — proactive, contextual delegation
Skills (contextual knowledge)  — probabilistic, knowledge-based
Rules (passive context)        — always-loaded background guidance
```

This hierarchy answers "where does this behavior go?" definitively.

---

## 6. Project-Scoped Memory as Default

**GSD's mistake** (from ECC's perspective): global instincts. React patterns contaminating Python projects. Solutions from one domain appearing where irrelevant.

ECC's model:
- Instincts are scoped to git repository (keyed by hashed git remote URL)
- Global scope is explicit promotion, not the default
- Universal patterns are elevated only when high-confidence in 2+ projects

**Analogy:** Variable scoping. Local by default, promoted to global explicitly when proven general.

---

## 7. Infrastructure Extends to the AI System Itself

ECC applies software engineering discipline not just to product code but to the AI system configuration itself:

- **AgentShield**: 1,282 tests + 102 static analysis rules for harness configuration security
- **Harness optimizer agent**: Audits the harness, not the product code
- **Tests for hooks**: The hooks system has its own test suite (997 tests)
- **Versioned skill files**: Skills have versions, changelogs, and breaking change notes

The AI configuration IS the system. It deserves the same rigor as application code.

---

## 8. Operational Autonomy with Safety Gates

ECC isn't just "run Claude automatically." It's structured autonomous operation:

**Loop operator agent** has explicit:
- Stop conditions (before starting)
- Stall detection (X retries without progress)
- Retry storm detection
- Quality gate enforcement
- Rollback paths
- Required pre-conditions: branch/worktree isolation

**Loop modes:** sequential, continuous-pr, rfc-dag, infinite

Autonomy is earned through safety gates, not assumed.

---

## 9. Cross-Harness Parity as Strategic Investment

Every ECC component is mirrored for 4 harnesses:
- Claude Code (`.claude/`)
- Cursor (`.cursor/`)
- Codex CLI (`.codex/`)
- OpenCode (`.opencode/`)

This is a significant investment that bets on harness diversity persisting. The implication: the patterns ECC encodes are portable across AI coding tools, not Claude-specific. The knowledge belongs to the system, not the tool.
