---
phase: 05-examples
plan: "01"
subsystem: docs
tags: [mintlify, mdx, examples, deno, zod, open-meteo]

requires:
  - phase: 04-integrations
    provides: Integration pages establishing docs structure and component patterns

provides:
  - docs/examples/index.mdx landing page with 8-card CardGroup
  - docs/examples/hello-world.mdx minimal 5-line runnable agent
  - docs/examples/weather-agent.mdx tool + outputSchema + Open-Meteo example

affects: [05-examples remaining plans]

tech-stack:
  added: []
  patterns:
    - "Example page structure: intro, What You'll Learn, Prerequisites, Complete Example, Run It, How It Works, Next Steps"
    - "Deno-native imports: npm:@vibes/framework, npm:@ai-sdk/anthropic, npm:zod"
    - "CardGroup cols=2 for examples landing page navigation"

key-files:
  created:
    - docs/examples/index.mdx
    - docs/examples/hello-world.mdx
    - docs/examples/weather-agent.mdx
  modified: []

key-decisions:
  - "Open-Meteo used for weather tool (free, no API key) ensuring copy-paste runnability"
  - "Agent<undefined, z.infer<typeof WeatherReport>> generics pattern established for typed output examples"
  - "Example page 7-section structure established as template for remaining 6 example pages"

patterns-established:
  - "Example page structure: intro, What You'll Learn, Prerequisites, Complete Example (typescript block), Run It (bash block), How It Works (bold subsections), Next Steps"
  - "All examples use deno run --allow-net --allow-env as the run command"

requirements-completed: [EX-01, EX-02, EX-03]

duration: 4min
completed: 2026-03-14
---

# Phase 05 Plan 01: Examples Landing Page, Hello World, and Weather Agent Summary

**Examples section foundation: CardGroup landing page, 5-line hello-world, and weather agent with tool()/outputSchema/Open-Meteo**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T16:58:22Z
- **Completed:** 2026-03-14T17:02:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created docs/examples/ directory and landing page with 8-card CardGroup covering all example categories
- Created hello-world.mdx as the simplest possible agent (5-line, copy-paste runnable with deno)
- Created weather-agent.mdx demonstrating tool(), outputSchema Zod schema, Open-Meteo free API, and typed Agent generics

## Task Commits

1. **Task 1: Create examples landing page** - `38f22c6` (feat)
2. **Task 2: Create hello-world example** - `992d831` (feat)
3. **Task 3: Create weather-agent example** - `e234b75` (feat)

## Files Created/Modified

- `docs/examples/index.mdx` - Landing page with CardGroup linking all 8 examples
- `docs/examples/hello-world.mdx` - Minimal agent: Agent constructor + agent.run(), deno run command, How It Works
- `docs/examples/weather-agent.mdx` - tool() with Open-Meteo fetch, outputSchema Zod schema, typed generics, How It Works

## Decisions Made

- Open-Meteo used for weather tool (free, no API key) ensuring copy-paste runnability without any setup
- Agent<undefined, z.infer<typeof WeatherReport>> generics pattern established for typed output examples
- 7-section page structure (intro, What You'll Learn, Prerequisites, Complete Example, Run It, How It Works, Next Steps) established as template for remaining 6 example pages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Examples foundation complete; docs/examples/ directory and page structure established
- Remaining 6 example pages (chat-app, bank-support, rag, graph-workflow, human-in-the-loop, a2a) follow the same 7-section pattern
- No blockers

---
*Phase: 05-examples*
*Completed: 2026-03-14*
