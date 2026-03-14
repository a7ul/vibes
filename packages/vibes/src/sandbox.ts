import {
	SandboxManager,
	type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { BASH_TIMEOUT_MS, MAX_OUTPUT_CHARS } from "./constants.ts";

export interface BashResult {
	stdout: string;
	stderr: string;
}

function truncate(text: string, label: string): string {
	if (text.length <= MAX_OUTPUT_CHARS) return text;
	return (
		text.slice(0, MAX_OUTPUT_CHARS) +
		`\n\n... [${label} truncated at ${MAX_OUTPUT_CHARS} chars]`
	);
}

let initialized = false;

export async function initSandbox(allowWriteDir: string): Promise<void> {
	if (initialized) return;
	const config: SandboxRuntimeConfig = {
		network: { allowedDomains: ["*"], deniedDomains: [] },
		filesystem: {
			denyRead: ["~/.ssh", "~/.aws", "~/.gnupg"],
			allowWrite: [allowWriteDir],
			denyWrite: [],
		},
	};
	await SandboxManager.initialize(config);
	initialized = true;
}

export async function runInSandbox(
	code: string,
	cwd: string,
	timeoutMs = BASH_TIMEOUT_MS,
): Promise<BashResult> {
	const wrappedCmd = await SandboxManager.wrapWithSandbox(
		`/bin/bash -c ${JSON.stringify(code)}`,
	);

	const proc = new Deno.Command("/bin/sh", {
		args: ["-c", wrappedCmd],
		cwd,
		stdout: "piped",
		stderr: "piped",
	}).spawn();

	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		try {
			proc.kill();
		} catch {
			// already exited
		}
	}, timeoutMs);

	try {
		const output = await proc.output();
		if (timedOut) {
			return { stdout: "", stderr: `Execution timed out after ${timeoutMs / 1000}s.` };
		}
		return {
			stdout: truncate(new TextDecoder().decode(output.stdout), "stdout"),
			stderr: truncate(new TextDecoder().decode(output.stderr), "stderr"),
		};
	} catch {
		return {
			stdout: "",
			stderr: timedOut
				? `Execution timed out after ${timeoutMs / 1000}s.`
				: "Process failed.",
		};
	} finally {
		clearTimeout(timer);
	}
}
