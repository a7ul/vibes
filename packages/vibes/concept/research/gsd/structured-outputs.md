# Structured Output Patterns from GSD

## 1. ⭐ PROJECT.md — Living Project Vision

The "always loaded" context document. Always small enough to read at every session start.

### Sections

**What This Is** — 2–3 sentence current accurate description. Updated when reality drifts from what was planned.

**Core Value** — The ONE thing that matters. Drives prioritization when tradeoffs arise. Forces clarity.

**Requirements** — Three buckets:
- Validated (shipped and working)
- Active (current scope)
- Out of Scope (with reasoning — WHY it was descoped, not just that it was)

**Context** — Background information informing implementation (market, prior art, constraints inherited from other systems).

**Constraints** — Hard limits with WHY (not just "must use Postgres" but "must use Postgres because ops team doesn't support other DBs").

**Key Decisions** — Table with outcome tracking:
```markdown
| Decision | Rationale | Status |
|----------|-----------|--------|
| Use JWT | Stateless, works with edge runtime | ✓ Good |
| Redis cache | Reduce DB load | ⚠️ Revisit |
| Mono repo | Simpler deploys | — Pending |
```

The document evolves: requirements move between buckets as features ship or get descoped.

**Applicable to vibes:** When generating project documentation, this is the anchor document. Generate PROJECT.md first. Everything else references it.

---

## 2. ⭐ CONTEXT.md — Decision Lock Pattern

Decisions captured in discuss-phase become NON-NEGOTIABLE for downstream agents.

### Three Sections

```markdown
## Decisions
LOCKED. Planner MUST implement exactly as specified.
- Auth: Use Clerk (not custom auth)
- Database: Postgres via Supabase
- No mobile app in v1

## Claude's Discretion
Freedom areas. Claude can choose approach.
- Component library choice
- Folder structure within /src
- Testing strategy

## Deferred Ideas
OUT OF SCOPE. Plans MUST NOT include these.
- Analytics dashboard (Phase 3)
- Team collaboration features (Phase 4)
- Export to PDF (future)
```

The planner self-check: "For each plan, verify every locked decision has a task implementing it, and no task implements a deferred idea."

**Scope guardrail:** If user suggests something beyond scope: "That's its own phase. I'll note it for later." Capture deferred ideas — don't lose them, don't act on them.

**Applicable to vibes:** Use this pattern for any artifact generation session. Lock what the user decided. Leave room for agent judgment. Capture good ideas that are out of scope.

---

## 3. ⭐ REQUIREMENTS.md — Checkable Requirements

Format: `- [ ] **AUTH-01**: User can sign up with email and password`

IDs are referenced in PLAN.md frontmatter (`requirements: [AUTH-01, AUTH-02]`), tracked in ROADMAP.md, and marked complete by the executor after each plan runs.

Full traceability: requirement → plan → code.

**Applicable to vibes:** When generating tickets, use a consistent ID scheme. Requirements can be checked off as tickets close.

---

## 4. ⭐ ROADMAP.md — Phase Structure with Success Criteria

Success Criteria per phase flow downstream to `must_haves` in plans.

```markdown
### Phase 1: Foundation
**Goal**: What this phase delivers
**Requirements**: [AUTH-01, AUTH-02, AUTH-03]
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password
  2. User receives confirmation email
  3. Session persists across browser refresh
**Plans**: 3 plans

Plans:
- [ ] 01-01: Auth models and database schema
- [ ] 01-02: Registration and login endpoints
- [ ] 01-03: Session management
```

**Applicable to vibes:** When generating a project roadmap, success criteria are the key output — not just phase names. Success criteria should be user-observable, not technical. Downstream ticket generators use success criteria as acceptance criteria.

---

## 5. ⭐ SUMMARY.md — Execution Record

After each plan executes:

**One-liner** — must be substantive, not generic:
- ✗ "Authentication implemented"
- ✓ "JWT auth with refresh rotation using jose, tokens stored in httpOnly cookies"

**Key files** — created/modified with brief purpose note

**Decisions made** — choices made during execution that weren't specified in the plan

**Deviations from plan** — auto-fixes applied, rules invoked, what changed and why

**Performance metrics** — duration, task count, file count

**Self-check** — verifies claimed files exist and commits exist in git

**Applicable to vibes:** When a vibes agent generates artifacts, it should produce a SUMMARY.md documenting what was generated, why key choices were made, and where to find each artifact.

---

## 6. ⭐ Atomic Git Commits Per Task

Every task gets its own commit immediately after completion.

Format: `{type}({phase}-{plan}): {concise task description}`

Types: feat, fix, test, refactor, chore. The phase-plan identifier makes bisect and revert surgical.

Never `git add .` — stage only task-related files by name.

**Applicable to vibes:** Each generated artifact (README, vision, ticket set) gets its own commit. Commit messages include what was generated and key decisions embedded.

---

## 7. Nyquist Validation — Test-as-Contract

During planning, each requirement is mapped to a specific automated test command. This creates a "validation architecture" — before code is written, the system knows exactly how to verify each requirement.

Named after the Nyquist theorem: sample at a rate high enough to detect failures.

**Applicable to vibes:** For README/ticket generation, define upfront what "correct" looks like. E.g., "README must contain: project name, installation steps, usage example, link to full docs."
