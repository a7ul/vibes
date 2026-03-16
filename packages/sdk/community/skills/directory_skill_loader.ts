import type { Skill, SkillLoader, SkillMeta } from "./types.ts";

/**
 * Parse YAML frontmatter from a markdown string.
 * Extracts `name` and `description` fields only.
 */
function parseFrontmatter(
  content: string,
): { name?: string; description?: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const block = match[1];
  const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = block.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

/**
 * Derive a skill name from a file path (strip directory and extension).
 */
function nameFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/i, "");
}

/**
 * Loads skills from a directory on disk.
 *
 * Discovery rules (applied in order):
 * 1. `<dir>/<name>.md` — a flat markdown file; frontmatter name/description are
 *    used when present, otherwise the filename is used as the name.
 * 2. `<dir>/<name>/SKILL.md` — a skill packaged as a sub-directory; the
 *    subdirectory name is used when no frontmatter name is present.
 *
 * @example
 * ```ts
 * const loader = new DirectorySkillLoader("/path/to/skills");
 * const toolset = new SkillsToolset(loader);
 * ```
 */
export class DirectorySkillLoader implements SkillLoader {
  constructor(private readonly dir: string) {}

  async listSkills(): Promise<SkillMeta[]> {
    const skills: SkillMeta[] = [];
    try {
      for await (const entry of Deno.readDir(this.dir)) {
        if (entry.isFile && entry.name.endsWith(".md")) {
          const filePath = `${this.dir}/${entry.name}`;
          const content = await Deno.readTextFile(filePath);
          const { name, description } = parseFrontmatter(content);
          skills.push({
            name: name ?? nameFromPath(entry.name),
            description: description ?? "",
          });
        } else if (entry.isDirectory) {
          const skillMdPath = `${this.dir}/${entry.name}/SKILL.md`;
          try {
            const content = await Deno.readTextFile(skillMdPath);
            const { name, description } = parseFrontmatter(content);
            skills.push({
              name: name ?? entry.name,
              description: description ?? "",
            });
          } catch {
            // No SKILL.md in this subdirectory — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return [];
      throw err;
    }
    return skills;
  }

  async loadSkill(name: string): Promise<Skill | null> {
    // Try flat file first
    const flatPath = `${this.dir}/${name}.md`;
    try {
      const content = await Deno.readTextFile(flatPath);
      const { name: fmName, description } = parseFrontmatter(content);
      return { name: fmName ?? name, description: description ?? "", content };
    } catch {
      // fall through
    }

    // Try subdirectory SKILL.md
    const dirPath = `${this.dir}/${name}/SKILL.md`;
    try {
      const content = await Deno.readTextFile(dirPath);
      const { name: fmName, description } = parseFrontmatter(content);
      return { name: fmName ?? name, description: description ?? "", content };
    } catch {
      // fall through
    }

    return null;
  }
}
