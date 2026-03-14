import { z } from "zod";
import { FunctionToolset, tool } from "@vibes/framework";
import { runInSandbox } from "../../../sandbox.ts";
import { sandboxDir } from "../../../file_system.ts";
import type { CoreAgentDeps } from "../../../types.ts";

const CodesSchema = z.object({
	codes: z.array(z.string()).describe("List of bash code snippets to execute"),
});

const bulkExecuteBashCodeSnippets = tool<CoreAgentDeps, typeof CodesSchema>({
	name: "bulk_execute_bash_code_snippets",
	description:
		"Execute a list of bash code snippets and return stdout + stderr for each snippet in the same order.",
	parameters: CodesSchema,
	execute: async (ctx, { codes }) => {
		const cwd = sandboxDir(ctx.deps.workflowId);
		return await Promise.all(codes.map((code) => runInSandbox(code, cwd)));
	},
});

export const bashToolset = new FunctionToolset<CoreAgentDeps>([
	bulkExecuteBashCodeSnippets,
]);
