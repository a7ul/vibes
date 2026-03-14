---
phase: 03
slug: core-concepts-part-2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | File-existence + grep checks (MDX docs phase) |
| **Config file** | none |
| **Quick run command** | `ls docs/concepts/*.mdx` |
| **Full suite command** | `grep -rl "mermaid" docs/concepts/ | wc -l` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `ls docs/concepts/*.mdx`
- **After every plan wave:** Verify all 6 new concept pages exist with mermaid blocks
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CONCEPT-09 | existence | `test -f docs/concepts/human-in-the-loop.mdx` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | CONCEPT-10 | existence | `test -f docs/concepts/testing.mdx` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | CONCEPT-11 | existence | `test -f docs/concepts/debugging.mdx` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | CONCEPT-12 | existence | `test -f docs/concepts/multi-agent.mdx` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | CONCEPT-13 | existence+grep | `test -f docs/concepts/graph.mdx && grep -v "this\.next()" docs/concepts/graph.mdx` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | CONCEPT-14 | existence | `test -f docs/concepts/thinking.mdx` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- None — MDX files are created in Wave 1 tasks directly.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mermaid diagrams render visually | CONCEPT-09 through 14 | Requires live Mintlify env | Open each concept page in browser, verify diagrams render |
| Graph API examples runnable | CONCEPT-13 | Requires Deno runtime | Copy graph examples, run with deno, verify no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
