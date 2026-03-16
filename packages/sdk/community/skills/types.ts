export interface SkillMeta {
  /** Unique skill identifier (parsed from frontmatter `name` or derived from filename). */
  name: string;
  /** Short description of what the skill does. */
  description: string;
}

export interface Skill extends SkillMeta {
  /** Full markdown content of the skill file. */
  content: string;
}

/**
 * Abstraction over skill storage. Implement this interface to load skills from
 * any source (filesystem, database, remote registry, etc.).
 *
 * The default implementation is `DirectorySkillLoader`.
 */
export interface SkillLoader {
  /** Return metadata for all available skills. */
  listSkills(): Promise<SkillMeta[]>;
  /** Return the full skill by name, or `null` if not found. */
  loadSkill(name: string): Promise<Skill | null>;
}
