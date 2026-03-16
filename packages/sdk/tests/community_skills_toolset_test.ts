import { assertEquals } from "@std/assert";
import { Agent, DirectorySkillLoader, SkillsToolset } from "../mod.ts";
import type { Skill, SkillLoader, SkillMeta } from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

// ---------------------------------------------------------------------------
// In-memory SkillLoader stub for testing
// ---------------------------------------------------------------------------

class StubSkillLoader implements SkillLoader {
  private readonly skills: Skill[];

  constructor(skills: Skill[]) {
    this.skills = skills;
  }

  listSkills(): Promise<SkillMeta[]> {
    return Promise.resolve(this.skills.map(({ name, description }) => ({ name, description })));
  }

  loadSkill(name: string): Promise<Skill | null> {
    return Promise.resolve(this.skills.find((s) => s.name === name) ?? null);
  }
}

const FIXTURE_SKILLS: Skill[] = [
  {
    name: "web-search",
    description: "Search the web for information",
    content: "# Web Search\nUse this skill to search the web.",
  },
  {
    name: "calculator",
    description: "Perform arithmetic calculations",
    content: "# Calculator\nUse this skill for math.",
  },
];

// ---------------------------------------------------------------------------
// SkillsToolset tool exposure tests
// ---------------------------------------------------------------------------

Deno.test("SkillsToolset - exposes skills_list and skills_load tools", async () => {
  let capturedNames: string[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedNames = (opts.tools ?? []).map((t: { name: string }) => t.name);
      return Promise.resolve(textResponse("done"));
    },
  });

  const loader = new StubSkillLoader(FIXTURE_SKILLS);
  const agent = new Agent({ model, toolsets: [new SkillsToolset(loader)] });
  await agent.run("help");

  assertEquals(capturedNames.includes("skills_list"), true);
  assertEquals(capturedNames.includes("skills_load"), true);
});

// ---------------------------------------------------------------------------
// Tool execution tests (direct)
// ---------------------------------------------------------------------------

function getTools(loader: SkillLoader) {
  const ts = new SkillsToolset(loader);
  return ts.tools(null as never);
}

Deno.test("SkillsToolset - skills_list returns all skills", async () => {
  const loader = new StubSkillLoader(FIXTURE_SKILLS);
  const tools = getTools(loader);
  const listTool = tools.find((t) => t.name === "skills_list")!;

  const raw = await listTool.execute(null as never, {});
  const result = JSON.parse(raw as string) as SkillMeta[];
  assertEquals(result.length, 2);
  assertEquals(result[0].name, "web-search");
  assertEquals(result[1].name, "calculator");
});

Deno.test("SkillsToolset - skills_load returns skill content", async () => {
  const loader = new StubSkillLoader(FIXTURE_SKILLS);
  const tools = getTools(loader);
  const loadTool = tools.find((t) => t.name === "skills_load")!;

  const result = await loadTool.execute(null as never, { name: "web-search" });
  assertEquals(result, "# Web Search\nUse this skill to search the web.");
});

Deno.test("SkillsToolset - skills_load returns error for unknown skill", async () => {
  const loader = new StubSkillLoader(FIXTURE_SKILLS);
  const tools = getTools(loader);
  const loadTool = tools.find((t) => t.name === "skills_load")!;

  const raw = await loadTool.execute(null as never, { name: "nonexistent" });
  const result = JSON.parse(raw as string);
  assertEquals(typeof result.error, "string");
  assertEquals(result.error.includes("nonexistent"), true);
});

Deno.test("SkillsToolset - skills_list returns empty array when no skills", async () => {
  const loader = new StubSkillLoader([]);
  const tools = getTools(loader);
  const listTool = tools.find((t) => t.name === "skills_list")!;

  const raw = await listTool.execute(null as never, {});
  const result = JSON.parse(raw as string);
  assertEquals(result.length, 0);
});

// ---------------------------------------------------------------------------
// DirectorySkillLoader tests (uses temp filesystem)
// ---------------------------------------------------------------------------

Deno.test("DirectorySkillLoader - listSkills discovers flat .md files", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${dir}/my-skill.md`,
      `---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\nContent here.`,
    );
    await Deno.writeTextFile(`${dir}/README.md`, "# Not a skill");

    const loader = new DirectorySkillLoader(dir);
    const skills = await loader.listSkills();

    assertEquals(skills.length, 2); // both .md files are discovered
    const mySkill = skills.find((s) => s.name === "my-skill");
    assertEquals(mySkill?.description, "A test skill");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("DirectorySkillLoader - listSkills discovers subdirectory SKILL.md", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(`${dir}/web-search`);
    await Deno.writeTextFile(
      `${dir}/web-search/SKILL.md`,
      `---\nname: web-search\ndescription: Search the web\n---\n\nContent.`,
    );

    const loader = new DirectorySkillLoader(dir);
    const skills = await loader.listSkills();

    assertEquals(skills.length, 1);
    assertEquals(skills[0].name, "web-search");
    assertEquals(skills[0].description, "Search the web");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("DirectorySkillLoader - loadSkill returns content for flat file", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const content = `---\nname: my-skill\ndescription: A skill\n---\n\n# Body`;
    await Deno.writeTextFile(`${dir}/my-skill.md`, content);

    const loader = new DirectorySkillLoader(dir);
    const skill = await loader.loadSkill("my-skill");
    assertEquals(skill?.name, "my-skill");
    assertEquals(skill?.content, content);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("DirectorySkillLoader - loadSkill returns null for missing skill", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const loader = new DirectorySkillLoader(dir);
    const skill = await loader.loadSkill("nope");
    assertEquals(skill, null);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("DirectorySkillLoader - listSkills returns empty for missing directory", async () => {
  const loader = new DirectorySkillLoader("/tmp/__vibes_nonexistent_dir__");
  const skills = await loader.listSkills();
  assertEquals(skills.length, 0);
});

// ---------------------------------------------------------------------------
// SkillsToolset integration with Agent
// ---------------------------------------------------------------------------

Deno.test("SkillsToolset - agent can call skills_list via model", async () => {
  let listCalled = false;
  const loader: SkillLoader = {
    listSkills: () => {
      listCalled = true;
      return Promise.resolve([{ name: "foo", description: "bar" }]);
    },
    loadSkill: () => Promise.resolve(null),
  };

  const responses = mockValues<DoGenerateResult>(
    toolCallResponse("skills_list", {}),
    textResponse("done"),
  );

  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.resolve(responses()),
  });

  const agent = new Agent({ model, toolsets: [new SkillsToolset(loader)] });
  await agent.run("list skills");

  assertEquals(listCalled, true);
});

Deno.test("SkillsToolset - accepts directory string and creates DirectorySkillLoader", () => {
  // Just verify construction doesn't throw
  const ts = new SkillsToolset("/some/dir");
  const tools = ts.tools(null as never);
  assertEquals(tools.length, 2);
  assertEquals(tools[0].name, "skills_list");
  assertEquals(tools[1].name, "skills_load");
});
