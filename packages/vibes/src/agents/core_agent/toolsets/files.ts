import { dirname, resolve } from "@std/path";
import { z } from "zod";
import { FunctionToolset, tool } from "@vibesjs/sdk";
import { runInSandbox } from "../../../sandbox.ts";
import { sandboxDir } from "../../../file_system.ts";
import { MAX_FILE_READ_BYTES } from "../../../constants.ts";
import type { CoreAgentDeps } from "../../../types.ts";

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function assertReadable(filePath: string, deps: CoreAgentDeps): void {
  const abs = resolve(filePath);
  const sandbox = resolve(sandboxDir(deps.workflowId));
  if (!abs.startsWith(sandbox) && !abs.startsWith(resolve(deps.contextDir))) {
    throw new Error(`Path ${filePath} is outside allowed directories.`);
  }
}

function assertWritable(filePath: string, deps: CoreAgentDeps): void {
  if (!resolve(filePath).startsWith(resolve(sandboxDir(deps.workflowId)))) {
    throw new Error(`Path ${filePath} is outside sandbox (read-only).`);
  }
}

function searchPaths(path: string, deps: CoreAgentDeps): string {
  const cwd = sandboxDir(deps.workflowId);
  return path ? shellQuote(path) : `${shellQuote(deps.contextDir)} ${shellQuote(cwd)}`;
}

const ReadFileSchema = z.object({
  file_path: z.string().describe("Path to the file to read"),
  offset: z.number().int().min(0).default(0).describe("Line to start from (0 = beginning)"),
  limit: z.number().int().min(0).default(0).describe("Max lines to return (0 = all)"),
});

const readFile = tool<CoreAgentDeps, typeof ReadFileSchema>({
  name: "read_file",
  description:
    "Read a file and return its contents with line numbers. Readable paths: /context/... or sandbox.",
  parameters: ReadFileSchema,
  execute: async (ctx, { file_path, offset, limit }) => {
    assertReadable(file_path, ctx.deps);
    let cmd = `cat -n ${shellQuote(file_path)}`;
    if (offset > 0) cmd += ` | tail -n +${offset}`;
    if (limit > 0) cmd += ` | head -n ${limit}`;
    cmd += ` | head -c ${MAX_FILE_READ_BYTES}`;
    return await runInSandbox(cmd, sandboxDir(ctx.deps.workflowId));
  },
});

const WriteFileSchema = z.object({
  file_path: z.string().describe("Sandbox path to write to"),
  content: z.string().describe("File content"),
});

const writeFile = tool<CoreAgentDeps, typeof WriteFileSchema>({
  name: "write_file",
  description: "Write content to a file inside the sandbox. Creates parent directories if needed.",
  parameters: WriteFileSchema,
  execute: async (ctx, { file_path, content }) => {
    assertWritable(file_path, ctx.deps);
    await Deno.mkdir(dirname(file_path), { recursive: true });
    await Deno.writeTextFile(file_path, content);
    return `Wrote ${file_path}`;
  },
});

const EditFileSchema = z.object({
  file_path: z.string().describe("Sandbox path to edit"),
  old_text: z.string().describe("Exact text to find (must be unique)"),
  new_text: z.string().describe("Replacement text"),
});

const editFile = tool<CoreAgentDeps, typeof EditFileSchema>({
  name: "edit_file",
  description: "Replace a text snippet in a file. old_text must match exactly once.",
  parameters: EditFileSchema,
  execute: async (ctx, { file_path, old_text, new_text }) => {
    assertWritable(file_path, ctx.deps);
    let text: string;
    try {
      text = await Deno.readTextFile(file_path);
    } catch {
      return `File not found: ${file_path}`;
    }
    const first = text.indexOf(old_text);
    if (first === -1) return "old_text not found in file.";
    if (text.indexOf(old_text, first + 1) !== -1) {
      let count = 0;
      let pos = 0;
      while ((pos = text.indexOf(old_text, pos)) !== -1) { count++; pos++; }
      return `old_text matches ${count} locations. Provide more context to make it unique.`;
    }
    await Deno.writeTextFile(file_path, text.replace(old_text, new_text));
    return `Edited ${file_path}`;
  },
});

const GlobFilesSchema = z.object({
  pattern: z.string().describe("Glob pattern (e.g. '*.py', '*.json')"),
  path: z.string().default("").describe("Root to search. Searches context + sandbox if empty."),
});

const globFiles = tool<CoreAgentDeps, typeof GlobFilesSchema>({
  name: "glob_files",
  description: "Search for files matching a glob pattern.",
  parameters: GlobFilesSchema,
  execute: async (ctx, { pattern, path }) => {
    const cwd = sandboxDir(ctx.deps.workflowId);
    const cmd = `find ${searchPaths(path, ctx.deps)} -name ${shellQuote(pattern)} -type f | head -500`;
    return await runInSandbox(cmd, cwd);
  },
});

const GrepFilesSchema = z.object({
  pattern: z.string().describe("Regex pattern to search for"),
  path: z.string().default("").describe("Root to search. Searches context + sandbox if empty."),
  include: z.string().default("").describe("Optional glob to filter filenames (e.g. '*.py')"),
});

const grepFiles = tool<CoreAgentDeps, typeof GrepFilesSchema>({
  name: "grep_files",
  description: "Search file contents for a regex pattern.",
  parameters: GrepFilesSchema,
  execute: async (ctx, { pattern, path, include }) => {
    const cwd = sandboxDir(ctx.deps.workflowId);
    let cmd = `grep -rn ${shellQuote(pattern)} ${searchPaths(path, ctx.deps)}`;
    if (include) cmd += ` --include=${shellQuote(include)}`;
    cmd += " | head -100";
    return await runInSandbox(cmd, cwd);
  },
});

export const filesToolset = new FunctionToolset<CoreAgentDeps>([
  readFile,
  writeFile,
  editFile,
  globFiles,
  grepFiles,
]);

export const filesReadonlyToolset = new FunctionToolset<CoreAgentDeps>([
  readFile,
  globFiles,
  grepFiles,
]);
