#!/usr/bin/env python3
"""Writes the pydantic-ai update issue body to /tmp/issue-body.md."""
import os

old = os.environ["OLD"]
new = os.environ["NEW_VERSION"]
summary = os.environ.get("SUMMARY", "")

body = f"""## Versions

| | Version |
|--|--|
| Previous | `v{old}` |
| New | `v{new}` |
| PyPI | https://pypi.org/project/pydantic-ai/{new}/ |
| Compare | https://github.com/pydantic/pydantic-ai/compare/v{old}...v{new} |

## Release Summary

{summary}

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
- [ ] Mark items as "not applicable" if Python-only or unrelated to agent framework

### For each relevant change
- [ ] Implement TypeScript equivalent in `packages/sdk/lib/`
- [ ] Write / update tests in `packages/sdk/tests/`
- [ ] Update docs in `packages/sdk/docs/`
- [ ] Export from `packages/sdk/mod.ts` if new public API

### Wrap-up
- [ ] Update feature parity table at `packages/sdk/docs/reference/features.mdx`
- [ ] Run `deno lint` in `packages/sdk/` — no lint errors
- [ ] Run `deno test -A` in `packages/sdk/` — all tests pass
- [ ] Open PR referencing this issue (branch: `chore/pydantic-ai-update-{new}`)
""".strip()

with open("/tmp/issue-body.md", "w") as f:
    f.write(body)

print("Issue body written to /tmp/issue-body.md")
