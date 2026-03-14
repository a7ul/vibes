# ⭐ Applicable Patterns for Vibes

Patterns from GSD directly applicable to a vibes agent that builds project artifacts: READMEs, tickets, visions, roadmaps.

---

## Priority 1 — Apply Immediately

### A. Thin Orchestrator + Fresh Subagents
**GSD pattern:** Orchestrator uses ~15% context. All heavy lifting in fresh subagent contexts.

**For vibes:** Main agent orchestrates. Dedicated subagents for:
- Vision drafting
- README generation
- Ticket creation
- Codebase analysis
- Research

Main agent stitches results together; it never authors the artifacts directly.

---

### B. Context Propagation Chain
**GSD pattern:** Each artifact is a context handoff for the next stage.

**For vibes:**
```
Vision ─→ Requirements ─→ Roadmap ─→ Tickets ─→ README
```
Each stage reads the previous. The README agent reads the vision + requirements + roadmap, not just the codebase. Prevents invented or misaligned content.

---

### C. Decision Lock Pattern
**GSD pattern:** CONTEXT.md with Decisions / Claude's Discretion / Deferred Ideas sections.

**For vibes:** After the opening conversation, produce a CONTEXT.md equivalent:
```markdown
## Locked Decisions
- Target audience: solo developers, not teams
- Tone: direct and technical, no marketing fluff
- Scope: v1 only, not future roadmap

## Agent's Discretion
- Section ordering
- Code example style

## Deferred / Out of Scope
- Localization (future)
- Multiple README formats (future)
```
Downstream agents MUST honor locked decisions. Deferred ideas are captured but never acted on.

---

### D. Questioning Philosophy
**GSD pattern:** "Dream extraction, not requirements gathering." Open first, narrow with concrete options.

**For vibes opening interaction:**
1. Open question: "Tell me about this project — what is it and what problem does it solve?"
2. Follow the energy (what did they get excited about?)
3. Challenge vagueness ("What do you mean by 'better workflow'?")
4. Use AskUserQuestion with 2–4 concrete options when narrowing
5. Never ask about the user's technical experience
6. Switch to freeform if user wants to narrate

---

### E. Analysis Paralysis Guard
**GSD pattern:** 5+ consecutive reads without a write → STOP and explain.

**For vibes:** Add to all artifact-generating agents. Prevents infinite codebase exploration before producing the README.

```
If you have read 5+ files without producing any output: STOP.
Write one sentence: why haven't you started writing yet?
Then: start writing, or report what specific information you still need.
```

---

### F. Structured Return Formats
**GSD pattern:** Agents return structured markdown (status, score, path), not prose.

**For vibes subagents:**
```markdown
## Generation Complete

**Status:** complete | partial | blocked
**Artifact:** /path/to/README.md
**Key Decisions:** (3 most important choices made)

### Gaps / Caveats
If any sections are incomplete or uncertain, list here.
```
Main agent reads the header, not the full artifact, to determine next step.

---

## Priority 2 — Apply When Building Artifact System

### G. Mandatory Initial Read Protocol
**GSD pattern:** CRITICAL marker forcing file reads before any other action.

**For vibes agents:**
```markdown
**CRITICAL: Read First**
Before generating any content, use the Read tool to load every file in the
<context> block below. Do not generate content based on your training knowledge
alone — always read the actual project files first.
```

---

### H. Goal-Backward Verification
**GSD pattern:** After generation, verify against goal, not just task completion.

**For vibes README:** After generating, verify:
- Does it describe THIS project, not a generic project?
- Does every code example reference actual files that exist?
- Does it have a working installation path?
- Would a new developer be unblocked after reading it?

Run this as a separate verification pass, not part of generation.

---

### I. Deferred Ideas Capture
**GSD pattern:** Capture out-of-scope ideas so they're never lost and never acted on.

**For vibes:** Maintain a `deferred.md` per project session. When user suggests something outside the current scope: "Great idea — I've captured it in deferred.md so we can revisit it." Never lose it, never build it prematurely.

---

### J. Vertical Slices Over Horizontal Layers
**GSD pattern:** Generate feature-complete slices, not all-of-one-type-first.

**For vibes parallel generation:**
```
Wave 1: [Auth vision+requirements+tickets] [Dashboard vision+requirements+tickets]
Wave 2: [README pulling from all Wave 1 outputs]
```

Not:
```
Wave 1: All visions
Wave 2: All requirements (depends on all visions)
Wave 3: All tickets (depends on all requirements)
```

---

### K. STATE.md Under 100 Lines
**GSD pattern:** Living session memory deliberately size-constrained.

**For vibes sessions:**
```markdown
# Vibes Session State

**Project:** my-app
**Stage:** Ticket generation (3/5 features done)
**Last Action:** Generated vision and requirements for auth feature

## Locked Decisions
(from CONTEXT.md — top 5 most important)

## Next
Generate tickets for dashboard feature using requirements in dashboard-requirements.md
```
Always read at start. Points to larger files, doesn't contain them.

---

## Priority 3 — Nice to Have

### L. Confidence Levels for Research
When researching a project's tech stack or ecosystem:
- HIGH: Official docs confirm
- MEDIUM: WebSearch confirmed by one official source
- LOW: Inferred from training data — flag explicitly

### M. Interface-First Ordering
When generating multiple connected artifacts, produce the structural document first. Vision before requirements. Requirements before tickets. README after all of them.

### N. Atomic Commits Per Artifact
One commit per generated artifact. Commit message: what was generated + 3 key decisions made.

### O. Session Continuity Files
For long generation sessions, create a `.continue-here.md` on pause:
- What was completed
- Exact next step
- Context files needed to resume

---

## What NOT to Take from GSD

GSD patterns that don't apply to vibes:

- **Wave computation** — GSD computes waves at plan time. Vibes artifact generation is simpler; sequential is fine for most cases.
- **Nyquist validation** — This is for code correctness testing. Vibes generates docs/tickets, not code that needs automated test coverage.
- **Deviation rules taxonomy** — GSD's auto-fix taxonomy is for code bugs. Vibes analog is simpler: flag unclear requirements, generate best-effort, note gaps.
- **gsd-tools CLI binary** — GSD uses a binary to prevent state corruption. Vibes doesn't need this level of state management unless it becomes stateful across many sessions.
