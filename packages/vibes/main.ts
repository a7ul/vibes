import { parseArgs } from "@std/cli/parse-args";
import { resolve } from "@std/path";
import { createCoreAgent } from "./src/agents/core_agent/agent.ts";
import { ensureSandboxDirs, sandboxDir } from "./src/file_system.ts";
import { initSandbox } from "./src/sandbox.ts";
import type { CoreAgentDeps } from "./src/types.ts";

const args = parseArgs(Deno.args, {
  string: ["workflow-id", "prompt", "context-dir"],
  boolean: ["verbose", "help"],
  alias: { h: "help", v: "verbose", p: "prompt", w: "workflow-id", c: "context-dir" },
});

if (args.help || !args.prompt || !args["workflow-id"]) {
  console.log(`
vibes - run a task with the core agent

Usage:
  vibes --workflow-id <id> --prompt <text> [options]

Options:
  -w, --workflow-id   Unique workflow identifier (required)
  -p, --prompt        Task prompt (required)
  -c, --context-dir   Read-only input directory (default: cwd)
  -v, --verbose       Stream output as it arrives
  -h, --help          Show this help
  `);
  Deno.exit(args.help ? 0 : 1);
}

const workflowId = args["workflow-id"]!;
const prompt = args.prompt!;
const contextDir = resolve(args["context-dir"] ?? Deno.cwd());
const runId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
const verbose = args.verbose;

await ensureSandboxDirs(workflowId);
await initSandbox(sandboxDir(workflowId));

const deps: CoreAgentDeps = { workflowId, contextDir, runId };
const agent = createCoreAgent();

if (verbose) {
  const stream = agent.stream(prompt, { deps });
  for await (const chunk of stream.textStream) {
    Deno.stdout.writeSync(new TextEncoder().encode(chunk));
  }
  const result = await stream.output;
  console.log(`\n\nStatus: ${result.taskStatus}`);
  console.log(`Summary: ${result.taskSummary}`);
  Deno.exit(result.taskStatus === "completed" ? 0 : 1);
} else {
  const result = await agent.run(prompt, { deps });
  console.log(`Status: ${result.output.taskStatus}`);
  console.log(`Summary: ${result.output.taskSummary}`);
  Deno.exit(result.output.taskStatus === "completed" ? 0 : 1);
}
