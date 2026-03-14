# State Management Patterns from GSD

## 1. ⭐ STATE.md — Size-Constrained Session Memory

STATE.md is the single file always read at session start. Deliberately **under 100 lines**.

```markdown
# State

**Current:** Phase 3, Plan 02 of 4
**Progress:** ████████░░ 75%

## Recent Decisions
- Auth: Chose Clerk over custom (easier OAuth)
- DB: Using Supabase Postgres (ops requirement)
- API: REST not GraphQL (team familiarity)

## Blockers
None

## Resume
If stopped: continue from .planning/phases/03/.continue-here.md
```

**Key insight:** Size constraint is a feature. A 1000-line state file is useless — it costs too much context to read, so agents skip it. Under 100 lines = always read.

**Applicable to vibes:** Maintain a small state file for each active project. Always loaded. Points to larger context files rather than containing them.

---

## 2. ⭐ Context Flow Direction

State flows forward, not backward. Each stage reads previous stage's output and produces its own — it never modifies earlier artifacts.

```
USER INPUT → PROJECT.md → REQUIREMENTS.md → CONTEXT.md → PLAN.md → SUMMARY.md
```

If earlier stages need updating (requirements change), that triggers a new cycle — not in-place mutation.

**Applicable to vibes:** Artifact generation is append-forward. New information creates new versions, doesn't edit older artifacts in place (unless explicitly asked).

---

## 3. ⭐ Session Continuity Pattern

`pause-work` creates a `.continue-here*.md` file with:
- Exact stopped position
- What was completed (table of tasks with commits)
- Next step (specific, not "continue where you left off")
- Context needed to resume (list of files to read)

`resume-work` reads STATE.md → follows pointer to `.continue-here*.md` → reconstructs context.

**Resume file format:**
```markdown
# Resume from: 2026-03-14 at 14:32

## Stopped At
Phase 3, Plan 02, Task 3 of 4

## Completed
| Task | Commit | Files |
|------|--------|-------|
| Create user model | abc1234 | src/models/user.ts |
| Create login endpoint | def5678 | src/api/auth/login.ts |

## Next Step
Implement session refresh endpoint in src/api/auth/refresh.ts.
Use existing jose setup from src/lib/jwt.ts.

## Context Files to Read
- @.planning/PROJECT.md
- @.planning/phases/03/CONTEXT.md
- @src/lib/jwt.ts (existing JWT setup)
```

**Applicable to vibes:** Long-running artifact generation sessions (e.g., generating a full project vision + roadmap + ticket set) should create resume files. User can pause and come back without losing context.

---

## 4. State Machine via CLI Binary

State updates happen via a Node.js binary, not by Claude writing raw text:

```bash
node gsd-tools.cjs state advance-plan
node gsd-tools.cjs state update-progress
node gsd-tools.cjs requirements mark-complete AUTH-01
node gsd-tools.cjs roadmap update-plan-progress 3
```

This prevents Claude from corrupting state files through free-form writing. The binary handles edge cases (concurrent updates, partial failures, malformed input).

**Applicable to vibes:** For critical state files, prefer structured writes through typed functions rather than letting the agent write raw text. Less flexible but more reliable.

---

## 5. Health and Repair

`/gsd:health [--repair]` validates the `.planning/` directory integrity:
- All required files present
- State pointers valid
- Phase directories consistent with ROADMAP.md
- No orphaned artifacts

Auto-repair handles common issues. Non-auto issues are surfaced as a checklist.

**Applicable to vibes:** Build a health-check function for any stateful artifact system. Detects corruption before it causes downstream failures.
