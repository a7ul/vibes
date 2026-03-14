import { join } from "@std/path";
import { SANDBOX_ROOT } from "./constants.ts";

export function sandboxDir(workflowId: string): string {
	return join(SANDBOX_ROOT, "sandboxes", workflowId);
}

export function tasksDir(workflowId: string): string {
	return join(sandboxDir(workflowId), "tasks");
}

export async function ensureSandboxDirs(workflowId: string): Promise<void> {
	const base = sandboxDir(workflowId);
	await Deno.mkdir(join(base, "pip", "tmp"), { recursive: true });
	await Deno.mkdir(join(base, "pip", "site-packages"), { recursive: true });
	await Deno.mkdir(tasksDir(workflowId), { recursive: true });
}
