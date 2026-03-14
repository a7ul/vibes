---
phase: 6
slug: advanced-topics-meta-and-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — documentation-only phase, structural smoke checks |
| **Config file** | none |
| **Quick run command** | `grep -r 'mermaid' docs/ --include="*.mdx" \| wc -l` |
| **Full suite command** | Run all smoke commands in Per-Task Verification Map |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific requirement's smoke command
- **After every plan wave:** Run full suite (all smoke commands)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | ADV-01 | smoke | `test -f docs/advanced/multimodal.mdx && grep -c "audio\|video\|image\|document" docs/advanced/multimodal.mdx` | Wave 0 | ⬜ pending |
| 06-01-02 | 01 | 1 | ADV-02 | smoke | `test -f docs/advanced/error-handling.mdx && grep -c 'mermaid' docs/advanced/error-handling.mdx` | Wave 0 | ⬜ pending |
| 06-01-03 | 01 | 1 | ADV-03 | smoke | `test -f docs/advanced/direct-model-requests.mdx` | Wave 0 | ⬜ pending |
| 06-02-01 | 02 | 1 | META-01 | smoke | `test -f docs/meta/acknowledgments.mdx && grep -c 'Pydantic AI' docs/meta/acknowledgments.mdx` | Wave 0 | ⬜ pending |
| 06-02-02 | 02 | 1 | META-02 | smoke | `test -f docs/meta/contributing.mdx` | Wave 0 | ⬜ pending |
| 06-02-03 | 02 | 1 | META-03 | smoke | `test -f docs/meta/changelog.mdx` | Wave 0 | ⬜ pending |
| 06-03-01 | 03 | 2 | NAV-01 | smoke | `node -e "const d=JSON.parse(require('fs').readFileSync('docs/docs.json')); const groups=d.navigation.groups.map(g=>g.group); console.log(groups.join(','))"` | ✅ | ⬜ pending |
| 06-03-02 | 03 | 2 | NAV-02 | smoke | `test ! -f docs/reference/core/agents.mdx && test ! -f docs/guides/human-in-the-loop.mdx` | ✅ | ⬜ pending |
| 06-03-03 | 03 | 2 | NAV-03 | smoke | `grep -r 'reference/core\|reference/advanced\|reference/integrations\|guides/' docs/ --include="*.mdx" \| grep -v "^docs/reference/features\|Binary\|^--" \| wc -l` (should be 0) | ✅ | ⬜ pending |
| 06-03-04 | 03 | 2 | NAV-04 | smoke | `grep -c 'reference/core\|reference/advanced\|guides/' docs/reference/features.mdx` (should output 0) | ✅ | ⬜ pending |
| 06-03-05 | 03 | 2 | DIAG-01 | smoke | `grep -r 'mermaid' docs/ --include="*.mdx" \| wc -l` (must be >= 30) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/advanced/` directory — create in Plan 1
- [ ] `docs/meta/` directory — create in Plan 2
- [ ] `docs/advanced/multimodal.mdx` — stub for ADV-01
- [ ] `docs/advanced/error-handling.mdx` — stub for ADV-02
- [ ] `docs/advanced/direct-model-requests.mdx` — stub for ADV-03
- [ ] `docs/meta/acknowledgments.mdx` — stub for META-01
- [ ] `docs/meta/contributing.mdx` — stub for META-02
- [ ] `docs/meta/changelog.mdx` — stub for META-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mermaid diagrams render correctly in browser | DIAG-01 | Rendering requires browser; automated check only counts syntax occurrences | Open each page with a Mermaid diagram and visually confirm rendering |
| Navigation UX matches Pydantic AI flow | NAV-01 | UX judgment | Navigate through docs.json sections and compare to Pydantic AI docs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
