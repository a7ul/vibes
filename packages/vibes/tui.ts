import { parseArgs } from "@std/cli/parse-args";
import { resolve } from "@std/path";
import { renderTui } from "./src/surface/tui/mod.ts";

const args = parseArgs(Deno.args, {
  string: ["workflow-id", "context-dir"],
  boolean: ["help"],
  alias: { h: "help", w: "workflow-id", c: "context-dir" },
});

if (args.help || !args["workflow-id"]) {
  console.log(`
vibes tui — interactive terminal UI for the core agent

Usage:
  deno task tui --workflow-id <id> [options]

Options:
  -w, --workflow-id   Unique workflow identifier (required)
  -c, --context-dir   Working context directory (default: cwd)
  -h, --help          Show this help
  `);
  Deno.exit(args.help ? 0 : 1);
}

globalThis.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  console.error("[tui] unhandled rejection:", e.reason);
});

renderTui({
  workflowId: args["workflow-id"]!,
  contextDir: resolve(args["context-dir"] ?? Deno.cwd()),
});
