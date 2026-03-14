---
phase: 05
slug: examples
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-14
---

# Phase 05 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | File-existence + grep checks (MDX docs phase) |
| **Config file** | none |
| **Quick run command** | `ls docs/examples/*.mdx` |
| **Full suite command** | `grep -rl "```ts" docs/examples/ | wc -l` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `ls docs/examples/*.mdx`
- **After every plan wave:** Verify all example pages exist with code blocks
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | EX-01 | existence | `test -f docs/examples/index.mdx` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | EX-02 | existence+grep | `test -f docs/examples/hello-world.mdx && grep "agent.run" docs/examples/hello-world.mdx` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | EX-03 | existence+grep | `test -f docs/examples/weather-agent.mdx && grep "outputSchema" docs/examples/weather-agent.mdx` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | EX-04 | existence+grep | `test -f docs/examples/chat-app.mdx && grep "useChat" docs/examples/chat-app.mdx` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | EX-05 | existence+grep | `test -f docs/examples/bank-support.mdx && grep "outputSchema" docs/examples/bank-support.mdx` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | EX-06 | existence+grep | `test -f docs/examples/rag.mdx && grep "tool" docs/examples/rag.mdx` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | EX-07 | existence+neg | `test -f docs/examples/graph-workflow.mdx && grep -q "next(" docs/examples/graph-workflow.mdx && ! grep -q "this\.next()" docs/examples/graph-workflow.mdx` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 1 | EX-08 | existence+grep | `test -f docs/examples/human-in-the-loop.mdx && grep "agent.resume" docs/examples/human-in-the-loop.mdx` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 1 | EX-09 | existence+grep | `test -f docs/examples/a2a.mdx && grep "A2AAdapter" docs/examples/a2a.mdx` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- None - MDX files are created in Wave 1 tasks directly.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Code examples copy-paste runnable | All EX-* | Requires Deno runtime | Copy each example, run with deno, verify output |
| Mermaid/nav renders visually | EX-01 | Requires live Mintlify env | Open examples index in browser |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
