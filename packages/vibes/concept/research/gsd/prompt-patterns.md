# Prompt Design Patterns from GSD

## 1. ⭐ XML Structure for Tasks

Plans use XML instead of prose for maximum Claude parsing reliability.

```xml
<task type="auto" tdd="true">
  <name>Task: Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <read_first>src/middleware/auth.ts, src/types/user.ts</read_first>
  <behavior>
    - Test 1: Valid credentials return 200 + Set-Cookie
    - Test 2: Invalid credentials return 401
  </behavior>
  <action>
    Use jose for JWT (not jsonwebtoken — CommonJS issues with Edge runtime).
    Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>
    <automated>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</automated>
  </verify>
  <acceptance_criteria>
    - login/route.ts contains "jose" import
    - Response includes "Set-Cookie" header
    - 401 returned for wrong password
  </acceptance_criteria>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

Key fields:
- `read_first` — what to load before writing
- `action` — specific with WHY, not just what
- `acceptance_criteria` — grep-verifiable, not prose
- `done` — measurable completion condition

**Applicable to vibes:** Use XML for complex multi-field task prompts. Prose gets ambiguous; XML forces structure that Claude parses reliably.

---

## 2. ⭐ Role Framing with Behavioral Constraints

Every agent starts with a `<role>` block that defines reasoning constraints, not just identity:

```markdown
<role>
You are a GSD phase verifier. You verify that a phase achieved its GOAL, not just completed its TASKS.

**Critical mindset:** Do NOT trust SUMMARY.md claims. SUMMARYs document what Claude SAID it did. You verify what ACTUALLY exists in the code.
</role>
```

The behavioral constraint ("Do NOT trust...") is as important as the identity.

**Applicable to vibes:** When prompting a README-writing agent, don't just say "write a README" — specify the mindset. E.g., "You write for someone who has never seen this project, not for someone already familiar with it."

---

## 3. ⭐ Mandatory Initial Read Protocol

All agents have this exact pattern:

```markdown
**CRITICAL: Mandatory Initial Read**
If the prompt contains a `<files_to_read>` block, you MUST use the Read tool to load every file listed there before performing any other actions. This is your primary context.
```

The CRITICAL marker and "before performing any other actions" are intentional — Claude sometimes skips file reading and relies on prompt context, leading to stale or invented content.

**Applicable to vibes:** Add this protocol to every agent that needs to read project state before acting.

---

## 4. ⭐ Structured Return Formats

Agents return structured markdown to the orchestrator, not free text:

```markdown
## Verification Complete

**Status:** gaps_found
**Score:** 3/5 must-haves verified
**Report:** .planning/phases/03-features/03-VERIFICATION.md

### Gaps Found
2 gaps blocking goal achievement:
1. **Chat renders messages** — Component is a placeholder (return <div>Placeholder</div>)
   - Missing: Real message list rendering with data
```

This enables reliable parsing by the orchestrator without NLP on prose.

**Applicable to vibes:** Define exact return format for every subagent. Status field, key data, file path to full output. Orchestrator reads the header, not the full body.

---

## 5. ⭐ Goal-Backward Verification

"Task completion ≠ Goal achievement"

Both plan-checker (before execution) and verifier (after execution) use:

1. What must be TRUE for the goal to be achieved? (truths)
2. What must EXIST for those truths to hold? (artifacts)
3. What must be WIRED for those artifacts to function? (key_links)

Encoded in PLAN.md frontmatter:

```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
      min_lines: 30
      contains: "messages.map"
  key_links:
    - from: "src/components/Chat.tsx"
      to: "/api/chat"
      via: "fetch in useEffect"
      pattern: "fetch.*api/chat"
```

Stubs and orphaned files are caught by checking all three levels (exists, substantive, wired).

**Applicable to vibes:** After generating a README, verify: does it actually describe the project? Does it have links that work? Is it connected to the real code (not invented examples)?

---

## 6. ⭐ Questioning Guide Philosophy

> "Project initialization is dream extraction, not requirements gathering."

Philosophy:
- You are a thinking partner, not an interviewer
- Start open, let the user dump their mental model
- Follow energy — what excited them? What problem sparked this?
- Challenge vagueness ("Good means what? Users means who?")
- NEVER ask about user's technical experience — Claude builds

**Use AskUserQuestion with 2–4 concrete options** rather than open-ended questions. Options reveal priorities, reduce cognitive load.

**Freeform rule:** If the user signals they want to explain freely ("let me describe it"), switch to plain text questions. Never force structured options when the user wants to narrate.

**Anti-patterns to avoid:**
- Checklist walking (asking all domains regardless of what they said)
- Canned questions ("What's your core value?")
- Corporate speak ("What are your success criteria?")
- Interrogation (firing questions without building on answers)
- Premature constraints (tech stack before understanding the idea)

**Applicable to vibes:** This is directly applicable to the initial "what are you building?" interaction. Start with an open question, follow energy, use concrete options when narrowing scope.

---

## 7. ⭐ Interface-First Task Ordering

Prevents executor "scavenger hunts" through the codebase:

1. First task: Define contracts (type files, interfaces, exports)
2. Middle tasks: Implement against the defined contracts
3. Last task: Wire everything together

**Applicable to vibes:** When generating multiple connected artifacts (vision + requirements + tickets), define the vision/structure first so subsequent agents have a contract to work against.

---

## 8. Plans Are Prompts

> "PLAN.md IS the prompt (not a document that becomes one)."

Language in plans is directive and specific — written to be directly consumed by Claude, not to describe what Claude should do.

**Wrong:** "The agent should implement authentication"
**Right:** "Create src/app/api/auth/login/route.ts. Use jose for JWT. Validate against users table. Return httpOnly cookie."

**Applicable to vibes:** Every task in a generated plan should be Claude-executable — specific file paths, specific libraries, specific behaviors — not descriptions of what should happen.
