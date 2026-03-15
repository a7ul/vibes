---
name: Pydantic AI Update
about: Port changes from a new pydantic-ai release into @vibesjs/sdk
title: "chore: port pydantic-ai v__NEW_VERSION__ changes"
labels: pydantic-ai-update
assignees: ''
---

## Versions

| | Version |
|--|--|
| Previous | `v__OLD_VERSION__` |
| New | `v__NEW_VERSION__` |
| PyPI | https://pypi.org/project/pydantic-ai/__NEW_VERSION__/ |
| Compare | https://github.com/pydantic/pydantic-ai/compare/v__OLD_VERSION__...v__NEW_VERSION__ |

## Release Summary

_Auto-filled by workflow — see below._

<!-- RELEASE_SUMMARY -->

## Porting Guide

Use `.claude/vibes-pydantic-porting.md` as the reference for all porting work. It covers:
- Framework structure and file locations (`packages/sdk/lib/`)
- How pydantic-ai Python concepts map to TypeScript / Vercel AI SDK equivalents
- Conventions: Zod for validation, immutable patterns, Deno test runner
- Feature parity table at `packages/sdk/docs/reference/features.mdx`

## Implementation Checklist

### Triage
- [ ] Review release notes and changed files above
- [ ] Identify which changes are relevant to vibes (new features, breaking changes, bug fixes)
- [ ] Mark items that are "not applicable" (Python-only, unrelated to agent framework)

### For each relevant change
- [ ] Implement TypeScript equivalent in `packages/sdk/lib/`
- [ ] Write / update tests in `packages/sdk/tests/`
- [ ] Update docs in `packages/sdk/docs/`
- [ ] Export from `packages/sdk/mod.ts` if new public API

### Wrap-up
- [ ] Update feature parity table at `packages/sdk/docs/reference/features.mdx`
- [ ] Run `deno lint` in `packages/sdk/` — no lint errors
- [ ] Run `deno test -A` in `packages/sdk/` — all tests pass
- [ ] Open PR referencing this issue
