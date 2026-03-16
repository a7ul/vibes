import { z } from "zod";
import { tool } from "../../lib/tool.ts";
import type { ToolDefinition } from "../../lib/tool.ts";
import type { Toolset } from "../../lib/toolsets/toolset.ts";
import type { RunContext } from "../../lib/types/context.ts";
import type { SkillLoader } from "./types.ts";
import { DirectorySkillLoader } from "./directory_skill_loader.ts";

const ListSkillsParams = z.object({});

const LoadSkillParams = z.object({
  name: z.string().describe("Name of the skill to load"),
});

/**
 * A toolset that lets an agent discover and load skills stored as markdown
 * files on disk. Ported from
 * [pydantic-ai-skills](https://github.com/DougTrajano/pydantic-ai-skills).
 *
 * Skills are `.md` files (or directories containing `SKILL.md`) that describe
 * a capability an agent can activate at runtime, instead of baking every
 * capability into the system prompt up-front.
 *
 * Exposes two tools: `skills_list`, `skills_load`.
 *
 * @example
 * ```ts
 * import { Agent } from "@vibesjs/sdk";
 * import { SkillsToolset } from "@vibesjs/sdk";
 * import { anthropic } from "@ai-sdk/anthropic";
 *
 * const agent = new Agent({
 *   model: anthropic("claude-sonnet-4-6"),
 *   toolsets: [new SkillsToolset("/path/to/skills")],
 * });
 * ```
 *
 * Or pass a custom `SkillLoader` for non-filesystem sources:
 * ```ts
 * const agent = new Agent({
 *   model: anthropic("claude-sonnet-4-6"),
 *   toolsets: [new SkillsToolset(myRemoteLoader)],
 * });
 * ```
 */
export class SkillsToolset<TDeps = undefined> implements Toolset<TDeps> {
  private readonly loader: SkillLoader;

  constructor(dirOrLoader: string | SkillLoader) {
    this.loader = typeof dirOrLoader === "string"
      ? new DirectorySkillLoader(dirOrLoader)
      : dirOrLoader;
  }

  tools(_ctx: RunContext<TDeps>): ToolDefinition<TDeps>[] {
    const loader = this.loader;

    return [
      tool<TDeps, typeof ListSkillsParams>({
        name: "skills_list",
        description:
          "List all available skills with their names and descriptions. Call this first to discover what capabilities are available.",
        parameters: ListSkillsParams,
        execute: async () => {
          const skills = await loader.listSkills();
          return JSON.stringify(skills);
        },
      }),

      tool<TDeps, typeof LoadSkillParams>({
        name: "skills_load",
        description:
          "Load the full instructions for a named skill. Returns the complete markdown content so you can follow the skill's instructions.",
        parameters: LoadSkillParams,
        execute: async (_ctx, args) => {
          const skill = await loader.loadSkill(args.name);
          if (!skill) {
            return JSON.stringify({
              error: `Skill "${args.name}" not found. Call skills_list to see available skills.`,
            });
          }
          return skill.content;
        },
      }),
    ];
  }
}
