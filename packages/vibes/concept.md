# Vibes - A Conversational Coding Agent

## The Core Idea

LLMs become the compiler. You speak, and the system progressively builds a tree of documents that describe your product in plain English - the way a product builder thinks about it. Not in terms of frameworks, routes, or libraries, but in terms of what the system does, who it's for, and how it behaves.

These documents live as `.md` files in a `vibes/` directory tree. Each directory is a feature area. Each subdirectory is a sub-feature. The folder structure *is* the project plan - no separate kanban board, no Jira, no syncing.

A parallel `app/` directory mirrors the `vibes/` tree. The LLM reads the spec files and compiles them into actual source code. Same relationship as `src/` and `dist/` in a TypeScript project, except the source language is English written at a PM level of abstraction.

```
project/
├── vibes/          ← product builder's brain: what & why (English)
│   ├── README.md
│   ├── frontend/
│   │   ├── README.md
│   │   ├── menu-browsing/
│   │   │   ├── README.md
│   │   │   ├── browse-menu.md
│   │   │   └── search-items.md
│   │   └── cart/
│   │       ├── README.md
│   │       └── ...
│   └── backend/
│       ├── README.md
│       ├── clients/
│       │   ├── README.md
│       │   ├── retrieve-client.md
│       │   └── create-client.md
│       └── orders/
│           ├── README.md
│           └── ...
│
└── app/            ← Engineer brain: how (code)
    ├── frontend/
    │   ├── menu-browsing/
    │   │   ├── MenuGrid.tsx
    │   │   └── Search.tsx
    │   └── cart/
    │       └── ...
    └── backend/
        ├── clients/
        │   ├── client.model.ts
        │   ├── client.service.ts
        │   └── client.routes.ts
        └── orders/
            └── ...
```

---

## The Abstraction Level: Product Builder Speak

This is the critical design decision. The spec files in `vibes/` are written at the level a product builder thinks - someone who is deeply technical AND deeply product-minded, understands how systems are built, but describes them in terms of behavior and intent rather than implementation specifics.

A product builder knows:

- "We have a server" - not that it's FastAPI or Express
- "You can retrieve a client" - not that it's `GET /clients/:id`
- "Email must be unique" - not that it's a Prisma `@unique` constraint
- "Orders go through stages" - not that it's a state machine with a specific enum
- "It should be fast" - not that you need Redis caching on this endpoint
- "The customer sees a list of items" - not that it's a React component with virtualized scrolling

The LLM bridges the gap. It reads product intent and decides the engineering specifics based on the stack, conventions, and context established at the project level.

This abstraction level is the sweet spot because:

1. It's high enough that non-engineers can read and validate the spec
2. It's detailed enough that the LLM has clear requirements to code against
3. It maps naturally to how products are actually planned in teams - PMs write tickets, engineers implement them
4. It separates *what* from *how*, so you can change the stack without rewriting the spec

---

## How the System Works

### Phase 1: Conversation → Structure

You start by talking to the agent. "I want to build a restaurant app." The agent's first job is not to write code - it's to figure out the shape of the project.

It asks clarifying questions conversationally:

- Is this a mobile app, web app, or both?
- Who are the users?
- What's the core thing they do?

From your answers, it classifies the architecture (frontend, backend, both, microservices, etc.) and creates the root structure:

```
vibes/
├── README.md               ← generated from conversation
├── frontend/
│   └── README.md           ← placeholder
└── backend/
    └── README.md           ← placeholder
```

The root `README.md` captures the high-level intent. The two directory `README.md` files are placeholders - they exist to mark that these areas need to be explored, but they don't have detail yet.

### Phase 2: Drill Down → Decomposition

You pick an area. "Let's talk about the backend." The agent asks about functionality - what does the server need to do? You describe clients, orders, menu management, reservations.

The agent decomposes this into sub-features, each as a folder with its own `README.md` and 3-4 child capability files:

```
vibes/backend/
├── README.md              ← now filled in
├── clients/
│   ├── README.md          ← placeholder
│   ├── retrieve-client.md ← placeholder
│   ├── create-client.md   ← placeholder
│   └── list-clients.md    ← placeholder
├── orders/
│   ├── README.md          ← placeholder
│   ├── place-order.md     ← placeholder
│   └── order-status.md    ← placeholder
└── menu/
    ├── README.md          ← placeholder
    └── ...
```

Each directory is a feature. Each `.md` capability file within it describes a specific thing the system can do. The `README.md` at each level describes what the feature area is about as a whole.

### Phase 3: Fill In → Detail

You keep talking. "Tell me more about clients." The agent asks how clients work, what data they have, what you can do with them. As you answer, it writes the spec files - not the placeholders anymore, but real product-builder-level specs.

A filled-in `retrieve-client.md` reads like this:

```markdown
# Retrieve a Client

We can look up a specific client to see their
details and history.

## When this happens
- Staff searches for a client by name or email
- System looks up client when processing an order
- Client views their own profile

## What comes back
- The client's name and contact info
- How many orders they've placed
- Their last 5 orders (just summaries)
- When they first visited
- Any upcoming reservations

## Edge cases
- If the client doesn't exist, show a clear
  "not found" message
- If the client is marked inactive, still show
  their info but flag it
- Phone number might be missing - that's okay,
  just leave it blank
```

No mention of HTTP methods, status codes, ORMs, or response schemas. Just what happens, what comes back, and what could go wrong. The LLM figures out the rest when it compiles.

### Phase 4: Compile → Code

Once a spec file is detailed enough, the LLM compiles it into actual source code in the `app/` directory. One spec file may produce multiple code files - a model, a service, a route handler, and tests.

The compiler reads:
- The spec file itself (the direct spec)
- The parent `README.md` (feature context)
- The root `README.md` (project context, stack decisions)
- Already-generated code from sibling specs (so it doesn't duplicate models or create conflicting interfaces)
- Parent `README.md` chain (the full path from root to this file)

---

## Directory-as-Ticket-Tree

The directory structure is the key insight. It mirrors how engineering teams actually organize work:

```
Directory level     │  What it represents
────────────────────│─────────────────────
vibes/              │  The project
├── README.md       │  Project-level context
├── frontend/       │  Epic / workstream
│   ├── README.md   │  Epic description
│   ├── menu/       │  Feature
│   │   ├── README.md  │  Feature description
│   │   ├── x.md    │  Capability
│   │   └── y.md    │  Capability
```

This maps directly to how tickets work in practice:

- A **project** has epics (top-level directories)
- Each **epic** has features (subdirectories)
- Each **feature** has capabilities (individual `.md` files)
- Grouped capabilities under a folder *are* a feature - the folder boundary defines it

Benefits:
- Project progress visible by which files are placeholders vs filled in
- Entire directories assignable to different conversations or agents
- Single feature regeneration by pointing compiler at one folder
- Directory tree is navigable, searchable, and version-controlled (just git)

---

## The Spec File Format

### Design Principles

1. **Plain markdown.** No custom syntax, no YAML frontmatter, no schema enforcement. Just headings and prose.
2. **Product-builder language.** Describes behavior, rules, and edge cases. Never mentions specific libraries, framework APIs, or implementation details.
3. **Self-contained enough.** Each file has enough context to understand without reading every other file.
4. **Progressive detail.** A placeholder has a title and rough notes. A filled-in file has behavior, edge cases, and acceptance criteria. No minimum required fields.

### File Types

Two reserved names per directory, everything else is a capability:

**README.md** - one per directory. At the root `vibes/` level it describes what you're building, who it's for, and the major architectural shape (stack decisions live here). At every subdirectory level it describes what that feature area covers and how its capabilities relate. GitHub renders these automatically at every level, making the entire spec tree a browsable documentation site.

**skill.md** - LLM instructions for a domain. Encodes tech stack, architecture, and compilation rules. The `vibes/` directory is the containment signal; no need to repeat it on every filename.

**[name].md** - individual capability files. Each describes a single thing the system can do. Leaf nodes that get compiled into code.

### Suggested Sections (not enforced)

For a capability file:
```
# [Capability Name]
[One or two sentences: what this is]

## When this happens
[What triggers this behavior]

## What it does / what comes back
[The happy path described plainly]

## Rules
[Business rules, validation, constraints]

## Edge cases
[What could go wrong and how to handle it]
```

For a directory `README.md` (feature level):
```
# [Feature Name]
[What this feature area covers]

## What it contains
[List of child capabilities and what each does]

## Rules that apply to everything here
[Cross-cutting concerns for this feature]
```

For the root `README.md` (project level):
```
# [Project Name]
[What you're building and why]

## Who uses this
[User types / personas]

## How it's structured
[Architecture shape: frontend, backend, etc.]

## Stack
[Decided technology choices - filled in as you discuss them]

## Important behaviors
[Project-wide rules and constraints]
```

---

## The Compilation Model

### How vibes/ maps to app/

The compiler maintains a 1:1 directory mapping. Every folder in `vibes/` has a corresponding folder in `app/`. But the file mapping is 1:many - one spec file can produce multiple code files.

```
vibes/backend/clients/retrieve-client.md
    ↓ compiles to
app/backend/clients/
    ├── client.model.ts      (shared across sibling specs)
    ├── client.service.ts     (findById method)
    ├── client.routes.ts      (GET endpoint)
    └── client.test.ts        (test cases from edge cases)
```

Multiple spec files in the same directory may contribute to the same code file. The compiler handles merging.

### Compilation Context

When compiling a spec file, the LLM receives:
1. The file itself - the direct spec
2. `README.md` from the same directory - feature-level context
3. Root `README.md` - project context, stack, conventions
4. Already-generated code from sibling specs - no duplicate models or conflicting interfaces
5. Parent `README.md` chain - full context path from root

### Compilation Strategies

**Bottom-up:** Compile leaf capability files first, then let parent README validate integration. Good for independent features.

**Top-down:** Start from the root README, generate project scaffolding (package.json, tsconfig, project structure), then compile features into that scaffold.

**Incremental:** When a spec file changes, only recompile that file and dependents. Track inter-spec dependencies.

### Traceability

Every generated file includes a comment header pointing back to source:

```typescript
// Generated from:
//   vibes/backend/clients/retrieve-client.md
//   vibes/backend/clients/README.md
```

Fix the spec file and recompile - never hand-edit generated code.

---

## The Conversation Agent

### Behavior Model

Two modes:

**Discovery mode** - asking questions, understanding intent, building structure. Default when starting a new project or drilling into a placeholder. Generates/updates spec files as you answer.

**Compilation mode** - reading spec files and generating code. Triggered explicitly ("compile the clients feature") or automatically when a file reaches sufficient detail.

Never both at once. Either refining the spec or generating code.

### Conversation → File Mapping

When you say "let's talk about how orders work," the agent:
1. Navigates to `vibes/backend/orders/`
2. Shows what exists (maybe just a placeholder `README.md`)
3. Starts asking questions
4. Creates child capability files or fills in placeholders as you answer
5. Summarizes what it wrote after each round

### Progressive Confidence

- **Placeholder** - title and rough notes only. Created during initial decomposition.
- **Drafted** - has behavior and rules but hasn't been reviewed in detail.
- **Discussed** - actively talked through with the agent. Edge cases covered.
- **Ready** - detailed enough to compile. All open questions resolved.

The agent suggests which placeholders to discuss next based on what would unblock the most compilation.

---

## How This Maps to Real Engineering Workflows

| Engineering workflow | Vibes equivalent |
|---|---|
| Product builder describes intent | Conversation phase - describe intent, agent structures as spec files |
| Tickets get decomposed | Drill-down phase - high-level areas become specific capabilities |
| Engineers implement tickets | Compilation phase - LLM reads each spec, writes the code |
| Tickets grouped by feature | Directory structure - related specs in a folder |
| Code organized by feature | app/ directory - mirrors vibes/ structure |

The whole pipeline - intent → specs → code - handled in one system. The intermediate representation (the `vibes/` tree) is always visible, editable, and version-controlled.

---

## Open Design Questions

- **Dependency tracking between specs.** Explicit `depends on` references vs compiler inferring from directory structure?
- **Shared concerns.** Auth, error handling, logging - own vibes directory, or encoded in the domain skill as project-wide rules that apply to all compilation in that domain?
- **Conflict resolution.** Two spec files with contradictory behavior - flag to user or auto-resolve?
- **When to recompile.** Single file, full feature, or whole project? Need a dependency graph or conservative "recompile the feature" default.
- **Infrastructure code.** Config files, build scripts, CI - generated from root `README.md` or a special `infra/` vibes directory?
- **Editing generated code.** `.lock` mechanism to mark hand-edited files, or strict "never edit app/" rule?
- **Multi-agent compilation.** Each feature folder is a natural parallel compilation unit - how to coordinate?
- **Testing strategy.** Edge cases section in spec files maps directly to test cases - compiler should generate tests automatically?

---

---

## Technical Implementation Plan

### Tech Stack

- **Language:** TypeScript / Deno
- **LLM Framework:** Vibes Framework (`@vibes/framework`) - provider-agnostic, structured outputs
- **File Format:** Pure markdown (README.md, skill.md, [name].md capability files)
- **Interface:** TUI (framework TBD - parked for now)
- **Package Manager:** Deno (npm: imports)

### Project Structure

```
vibes/
├── deno.json
├── main.ts                      ← entry point (CLI)
└── src/
    ├── agent.ts                 ← vibes agent (core agent + vibes SKILL.md)
    └── SKILL.md                 ← the whole behavior: conversation, decompose, compile
```

Domain skills live in the user's project inside `vibes/`, not in the tool. They carry everything needed to compile that domain:

```
project/vibes/
├── README.md
├── backend/
│   ├── skill.md          ← tech stack + architecture + compilation instructions for backend
│   ├── README.md
│   └── clients/
│       └── ...
└── frontend/
    ├── skill.md          ← tech stack + architecture + compilation instructions for frontend
    └── ...
```

A `backend/skill.md` encodes:
- **Vision** - what this part of the system is trying to do
- **Architecture** - how it's structured (layered, hexagonal, etc.)
- **Tech stack** - Express + Prisma + PostgreSQL, or FastAPI + SQLAlchemy, or Hono + Drizzle - whatever was decided
- **Compilation rules** - what files to generate, naming conventions, patterns to follow

This means the spec files are completely portable and stack-agnostic. Swap `backend/skill.md` from an Express skill to a FastAPI skill and the same spec compiles to a different language and framework. The product intent never changes - only the "how to build it" changes.

### Core Concepts

#### The Vibes Tree

The vibes tree is the project's directory structure read as a tree data structure. Every directory is a node. Every spec file is a leaf (or a property of a node). The tree is the single source of truth for project state.

```typescript
// src/models/tree_node.ts

export type NodeStatus =
  | "placeholder"  // title + rough notes only
  | "drafted"      // has content but not discussed
  | "discussed"    // actively refined through conversation
  | "ready"        // detailed enough to compile
  | "compiled";    // code exists in app/

export type NodeType =
  | "vision"   // root README.md
  | "ticket"   // directory-level README.md
  | "task";    // individual capability [name].md file

export interface TreeNode {
  path: string;               // absolute path to vibes file or directory
  name: string;               // human-readable name derived from filename
  nodeType: NodeType;
  status: NodeStatus;
  content: string | null;     // raw markdown content if loaded
  children: TreeNode[];
  parent: TreeNode | null;
}
```

Status is inferred from content, not stored as metadata. Heuristics:
- File doesn't exist or has `_awaiting conversation_` → `PLACEHOLDER`
- File has content but fewer than ~5 substantive lines → `PLACEHOLDER`
- File has behavior/rules sections → `DRAFTED`
- File has edge cases + acceptance criteria → `DISCUSSED` / `READY`
- Corresponding files exist in `app/` → `COMPILED`

#### The Skill System

A `skill.md` file teaches the LLM how to work within a domain. It sits alongside the vibes files it governs:

```
vibes/
├── README.md
├── skill.md              ← root/vision skill
├── frontend/
│   ├── skill.md          ← frontend skill
│   └── ...
└── backend/
    ├── skill.md          ← backend skill
    └── ...
```

Skill resolution: walk up the tree from the current path, use the nearest `skill.md`. Falls back to bundled defaults. Child skill overrides parent completely - no merging.

Skills contain: how to decompose the domain, how to write vibes at PM level, how to compile (what code files to produce and how).

#### One Agent, Multiple Skills

The vibes agent is the existing core agent with a different SKILL.md. Same toolset, no new code:

- `bulk_execute_bash_code_snippets` - create directories, run generated code
- `read_file`, `write_file`, `edit_file` - read/write spec files and `app/` files
- `glob_files`, `grep_files` - walk and search the vibes tree
- `create_task` / `get_task_output` / `resume_task` - spawn the existing `general`, `explore`, or `plan` subagents when needed

The agent carries multiple skills. Which skill is active depends on what the agent is doing at that moment - conversing, decomposing a ticket, or compiling a feature. These aren't separate agents or modes; they're sections of the SKILL.md that tell the agent how to behave in different situations.

The `general`/`explore`/`plan` subagents are available for parallel work (e.g., compiling multiple features simultaneously) but there are no custom subagent types. The SKILL.md is what makes it a vibes agent rather than a general-purpose agent. Everything else is inherited.

#### Compilation Pipeline

Compilation happens at the **directory level** - the compiler reads all spec files in a directory and produces all code for that feature at once. This prevents conflicts (e.g., two specs shaping the same model).

Context passed to compiler:
1. All capability `.md` files in the directory
2. `README.md` from same directory
3. Root `README.md`
4. Already-generated code from the same `app/` directory
5. Full parent `README.md` chain from root

Bottom-up compilation order: leaf directories first, then work up.

Every generated file includes a header tracing back to source specs:
```typescript
// Generated from:
//   vibes/backend/clients/retrieve-client.md
//   vibes/backend/clients/README.md
```

### Implementation Order

**Phase 1: Foundation**
1. Project structure, `deno.json`, import map wiring (`@vibes/framework`)
2. `VibesProject` - init, read, write operations
3. `TreeNode` model and `read_tree` - parse directory into tree
4. Skill loader - resolve `skill.md` from tree position, ship defaults
5. Default skill files - `root.md`, `backend.md`, `frontend.md`

**Phase 2: Conversation Agent**
6. Context builder - assemble LLM context from tree position
7. Conversation agent - basic discovery loop, writes vibes files
8. Decomposer agent - breaks tickets into sub-tickets and directories
9. Main loop - `input()` based CLI, apply updates, refresh tree

**Phase 3: Compiler**
10. Compilation context builder - gather specs + existing code + parent chain
11. Compiler agent - read specs, produce code files
12. `compile_directory` - compile one feature, write to `app/`
13. `compile_project` - bottom-up full project compilation

**Phase 4: Polish**
14. Status detection improvements - better heuristics for vibes readiness
15. Incremental recompilation - track what changed, recompile only affected features
16. Error feedback - run generated code, feed errors back to compiler
17. TUI integration - replace `input()` with proper interface

### Configuration

`vibes.json` at project root:
```json
{
  "llm": {
    "conversationModel": "claude-sonnet-4-20250514",
    "decomposerModel": "claude-sonnet-4-20250514",
    "compilerModel": "claude-sonnet-4-20250514"
  }
}
```

---

## What to Build First (MVP)

1. **The conversation agent** - takes user input, generates directory structure and spec files. Single-level decomposition to start. CLI that reads/writes to the local filesystem.
2. **The spec format** - dead simple markdown. No parsing beyond headings. LLM reads raw text.
3. **A single-file compiler** - takes one capability `.md` file plus its `README.md` and root `README.md` context, outputs code files into the matching `app/` directory.
4. **The feedback loop** - after compilation, run the code (or tests), feed errors back to the agent, let it fix code or suggest spec updates.

Start with a backend-only project (an API server). Add frontend compilation once the core loop works.
