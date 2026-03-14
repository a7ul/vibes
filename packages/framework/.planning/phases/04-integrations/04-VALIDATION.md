---
phase: 04
slug: integrations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | File-existence + grep checks (MDX docs phase) |
| **Config file** | none |
| **Quick run command** | `ls docs/integrations/*.mdx` |
| **Full suite command** | `grep -rl "mermaid" docs/integrations/ | wc -l` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `ls docs/integrations/*.mdx`
- **After every plan wave:** Verify all integration pages exist with mermaid blocks
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INT-01a | existence+grep | `test -f docs/integrations/mcp-client.mdx && grep "MCPManager" docs/integrations/mcp-client.mdx` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | INT-01b | existence+grep | `test -f docs/integrations/mcp-server.mdx && grep "mermaid" docs/integrations/mcp-server.mdx` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | INT-02 | existence+neg | `test -f docs/integrations/ag-ui.mdx && grep -q "getState" docs/integrations/ag-ui.mdx && ! grep -q "depsFactory" docs/integrations/ag-ui.mdx` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | INT-03 | existence+grep | `test -f docs/integrations/a2a.mdx && grep "A2AAdapter" docs/integrations/a2a.mdx` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | INT-04 | existence+neg | `test -f docs/integrations/temporal.mdx && grep -q "workflowFn" docs/integrations/temporal.mdx` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | INT-05 | existence+grep | `test -f docs/integrations/vercel-ai-ui.mdx && grep "useChat" docs/integrations/vercel-ai-ui.mdx` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- None — MDX files are created in Wave 1 tasks directly.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mermaid diagrams render visually | INT-01 through INT-05 | Requires live Mintlify env | Open each integration page in browser |
| AG-UI SSE stream works end-to-end | INT-02 | Requires running server | Start agent server, connect AG-UI client, verify events |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
