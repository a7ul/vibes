---
phase: 02
slug: core-concepts-part-1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | File-existence + grep checks (MDX docs phase) |
| **Config file** | none |
| **Quick run command** | `ls docs/concepts/*.mdx` |
| **Full suite command** | `grep -l "mermaid" docs/concepts/*.mdx \| wc -l` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `ls docs/concepts/*.mdx`
- **After every plan wave:** Verify all 8 concept pages exist with mermaid blocks
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CONCEPT-01 | existence | `test -f docs/concepts/agents.mdx` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CONCEPT-02 | existence | `test -f docs/concepts/models.mdx` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | CONCEPT-03 | existence | `test -f docs/concepts/dependencies.mdx` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | CONCEPT-04 | existence | `test -f docs/concepts/tools.mdx` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | CONCEPT-05 | existence | `test -f docs/concepts/toolsets.mdx` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CONCEPT-06 | existence | `test -f docs/concepts/results.mdx` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | CONCEPT-07 | existence | `test -f docs/concepts/messages.mdx` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | CONCEPT-08 | existence | `test -f docs/concepts/streaming.mdx` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- None — MDX files are created in Wave 1 and Wave 2 tasks directly.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mermaid diagrams render visually | CONCEPT-01 through 08 | Requires live Mintlify env | Open each concept page in browser, verify diagrams render |
| Code examples copy-paste runnable | All CONCEPT-* | Requires Deno runtime | Copy each snippet, run with deno, verify no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
