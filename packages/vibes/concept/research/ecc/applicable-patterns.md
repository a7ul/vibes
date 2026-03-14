# ⭐ Applicable ECC Patterns for Vibes

Patterns from ECC directly applicable to a vibes agent that builds project artifacts: READMEs, tickets, visions, roadmaps.

---

## Priority 1 — Apply Immediately

### A. Hooks for Guaranteed Behaviors

**ECC pattern:** Hooks fire 100% of the time. Skills fire 50-80%.

**For vibes:** Any behavior that must happen every run belongs in a hook, not a skill or prompt instruction.

Candidates for vibes hooks:
- **SessionStart**: Load previous project state for this session
- **Stop**: Persist what was generated, what's incomplete, what's next
- **PostToolUse on Write**: Log every generated artifact to a session manifest

```json
// hooks.json pattern
{
  "Stop": [
    {
      "script": "scripts/hooks/persist-session.js",
      "description": "Save generated artifacts and next steps"
    }
  ]
}
```

---

### B. Iterative Retrieval for Codebase Analysis

**ECC pattern:** DISPATCH→EVALUATE→REFINE→LOOP with relevance scoring.

**For vibes:** When analyzing a codebase to generate a README or vision, don't dump all files into context. Use iterative retrieval:

1. DISPATCH: Read top-level files (README, package.json, main entry points)
2. EVALUATE: Score relevance of each to the document being generated (0.0-1.0)
3. REFINE: If needed, follow imports and read referenced modules
4. LOOP: Continue until enough high-relevance files found (max 3 iterations)

Prevents context blowout from reading an entire large codebase when only a few files define the project's essence.

---

### C. Project-Scoped Memory

**ECC pattern:** Instincts isolated by git remote URL. Global scope is explicit promotion.

**For vibes:** When vibes learns something about a project (tone preferences, tech stack, naming conventions, what the user rejected), scope it to that project.

```
~/.vibes/projects/{repo-hash}/
  preferences.md    ← user's stated preferences for this project
  rejected.md       ← what they didn't like + why
  conventions.md    ← detected patterns from codebase
  session.md        ← last session state
```

Global vibes preferences live at `~/.vibes/global/preferences.md` — only things that apply to all projects.

---

### D. Confidence-Scored Knowledge

**ECC pattern:** Atomic instincts with confidence scores (0.3-0.9). Higher confidence = more aggressively applied.

**For vibes:** When detecting project conventions (tone, section structure, naming), score confidence:

```markdown
## Detected Conventions

**Tone: Technical, minimal prose** (confidence: 0.9 — consistent across 12 existing files)
**Section order: Why → What → How** (confidence: 0.7 — seen in 5 of 8 existing docs)
**Code examples: Always with language tag** (confidence: 0.5 — seen in 3 files)
```

Low-confidence detections are applied as defaults but flagged for user confirmation. High-confidence detections are applied silently.

---

### E. Session State Persistence

**ECC pattern:** Stop hooks write session state. SessionStart hooks reload it.

**For vibes multi-session projects:**

```markdown
# Vibes Session: {project-name}
**Date:** 2026-03-14
**Stage:** Ticket generation (3/5 features done)

## Generated So Far
- [x] vision.md
- [x] requirements.md
- [x] tickets/auth.md
- [x] tickets/dashboard.md
- [ ] tickets/notifications.md (in progress — partial output saved)
- [ ] README.md (not started)

## User Preferences (this session)
- Tone: "direct, no fluff"
- Audience: "senior engineers, not new hires"
- Rejected: "startup jargon like 'leverage' and 'synergy'"

## Next
Generate notifications tickets, then README pulling from all completed artifacts
```

This state is loaded at the start of the next conversation automatically.

---

### F. Tiered Output Severity

**ECC pattern:** Code reviewer uses CRITICAL/HIGH/MEDIUM/LOW with 80% confidence filter.

**For vibes artifact review:** When the vibes agent reviews its own output before delivering:

```markdown
## Vibes Quality Check

**[CRITICAL] Missing installation instructions** — README has no "Getting Started" section
**[HIGH] Code examples reference non-existent files** — src/auth.ts doesn't exist in this repo
**[MEDIUM] Inconsistent terminology** — "endpoint" vs "route" used interchangeably

Skipping LOW confidence issues.
```

Only deliver CRITICAL/HIGH findings to the user. MEDIUM are fixed silently. LOW are ignored.

---

### G. Sequential Handoff Documents

**ECC pattern:** Each stage in a workflow produces a structured handoff for the next stage.

**For vibes artifact pipeline:**
```
Vision → Requirements → Roadmap → Tickets → README
```

Each stage reads the handoff from the previous stage explicitly:

```markdown
## Handoff: vision-agent → requirements-agent

**Project Summary:** [3 sentences max]
**Key Decisions:**
- Target user: solo developers
- Scope: v1 only, no future roadmap
- Tone: technical, not marketing

**Requirements Agent Instructions:**
Generate requirements that serve the target user. Reject any requirement
not directly supporting the key decisions above.
```

The next agent reads the handoff, honors the locked decisions, and produces its own handoff for the stage after.

---

## Priority 2 — Apply When Building Artifact System

### H. Analysis Paralysis Guard

**ECC pattern:** Loop operator detects stalls via "X retries with same error → escalate."

**For vibes:** Any artifact-generating agent must have a forward-progress rule:

```
If you have read 5+ files without producing any artifact output: STOP.
State in one sentence: why haven't you started generating yet?
Then: start generating with what you have, or report the specific gap.

If you have written a section and then deleted it without replacement: STOP.
This is a stall. Choose one version and commit to it.
```

---

### I. Goal-Backward Verification

**ECC pattern:** After execution, verify against goal, not just task completion.

**For vibes README:** After generating, run a verification pass:

```
Does this describe THIS project, not a generic project?
  → Test: Remove the project name. Would this README describe 3 other projects? If yes: fail.

Does every code example run correctly?
  → Test: Are the commands real commands this project supports?

Would a new developer be unblocked after reading this?
  → Test: Can they install and run a "hello world" using only this README?

Does it match the user's stated tone preference?
  → Test: Count adjectives. Are any flagged as unwanted?
```

Run verification as a separate pass before delivering the artifact.

---

### J. The 80% Confidence Filter (For Own Output)

**ECC pattern:** Code reviewer skips issues below 80% confidence.

**For vibes:** When the vibes agent is uncertain about a section:

```
If I am less than 80% confident this section is accurate:
  → Generate it but mark it: [VERIFY: this section assumes X — please confirm]
  → Do not omit it (would be worse)
  → Do not assert it as fact (would be misleading)
```

This prevents vibes from silently generating plausible-but-wrong content.

---

### K. Harness Self-Audit (Future)

**ECC pattern:** 70-point scorecard for the harness itself.

**For vibes:** Once the vibes agent is built, create a quality scorecard:

```
Artifact Quality (0-10):   Does output match user intent?
Coverage (0-10):           Does it cover all requested sections?
Accuracy (0-10):           Are factual claims correct?
Tone Match (0-10):         Does it match user's stated preferences?
Actionability (0-10):      Can a developer use it immediately?
```

Run this scorecard on a sample of generated artifacts periodically. Track trends over time.

---

## Priority 3 — Nice to Have

### L. Model Routing for Artifact Generation

**ECC pattern:** Haiku for lightweight, Sonnet for main work, Opus for complex reasoning.

**For vibes:**
- Haiku: Initial codebase scan, file listing, simple format detection
- Sonnet: Full artifact generation (READMEs, visions, requirements)
- Opus: Complex architectural analysis before generating vision docs for large systems

---

### M. Eval-Driven Development for Vibes Itself

**ECC pattern:** Evals as unit tests of AI behavior. Stored alongside code.

**For vibes:** Create evals for the vibes agent:

```markdown
## Eval: readme-completeness

**Input:** Express.js REST API with /users and /posts endpoints

**Pass criteria:**
- Mentions both endpoints
- Has working curl example
- Has installation instructions
- Has environment variable documentation

**Metrics:** pass@3 >= 0.9
```

Run evals when changing the vibes agent's prompts or skills.

---

### N. Instinct Pipeline for Vibes Preferences

**ECC pattern:** Session observation → pattern detection → instinct files.

**For vibes:** After each session, extract user preference instincts:

```markdown
---
name: user-prefers-direct-tone
trigger: When generating any user-facing text for this project
confidence: 0.8
project: /repos/my-project
---

User has rejected marketing language in 3 sessions. Use direct technical tone.
Avoid: "powerful", "leverage", "seamless", "robust"
Use: specific technical capabilities and concrete examples
```

These instincts are loaded at the start of the next session to personalize generation.

---

## What NOT to Take from ECC

ECC patterns that don't apply (or over-engineer) vibes:

- **AgentShield / 1,282 rules** — Security scanning of the harness configuration itself. Vibes doesn't need this level of meta-security.
- **Cross-harness parity** — Mirroring for Cursor/Codex/OpenCode. Vibes is Claude Code native.
- **Chief-of-staff agent** — Email/Slack triage is out of scope for a project artifact generator.
- **Infinite loop mode** — Production monitoring loops. Vibes generates artifacts, doesn't run continuously.
- **dmux-workflows** — tmux multi-pane orchestration. Adds operational complexity vibes doesn't need.
- **Multi-model collaboration** — Claude + Codex + Gemini. The integration complexity exceeds the benefit for document generation.
