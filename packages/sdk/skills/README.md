# @vibesjs/sdk Agent Skill

An installable agent skill that gives your coding assistant complete knowledge of the `@vibesjs/sdk` API — tools, agents, toolsets, dependency injection, structured output, streaming, testing, graph workflows, MCP, and more.

Once installed, your coding agent can write idiomatic `@vibesjs/sdk` code without needing to look up documentation.

## Install

### Option 1: curl (one command)

**Project-level** (recommended — scoped to this project):

```bash
mkdir -p .claude/agents && curl -fsSL https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/skills/vibes-framework.md -o .claude/agents/vibes-framework.md
```

**Global** (available in all your projects):

```bash
mkdir -p ~/.claude/agents && curl -fsSL https://raw.githubusercontent.com/vibe-ts/vibes/main/packages/sdk/skills/vibes-framework.md -o ~/.claude/agents/vibes-framework.md
```

### Option 2: Copy manually

Copy `vibes-framework.md` from this directory to:
- **Project-level**: `.claude/agents/vibes-framework.md` in your project root
- **Global**: `~/.claude/agents/vibes-framework.md`

## Usage

After installing, reference the skill in your conversation:

```
Use the vibes-framework skill to help me build an agent that...
```

Or Claude Code will pick it up automatically when you're working on a project that uses `@vibesjs/sdk`.

## Keeping it updated

The skill is versioned alongside the framework. When you upgrade `@vibesjs/sdk`, re-run the install command to pull the latest skill.

## How it works

The skill does **not** embed a static copy of the API. Instead, it instructs the coding agent to:

1. Fetch live docs via [Context7](https://context7.com) (if available) — always reflects the latest published version
2. Fall back to fetching docs directly from the GitHub repo via `WebFetch`
3. Apply a small set of static "gotchas" — non-obvious patterns that are easy to get wrong regardless of framework version

This means the skill stays accurate as the framework evolves — no manual updates needed.
