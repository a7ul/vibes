export const MODEL = "claude-sonnet-4-6";
export const MAX_TURNS = 50;
export const MAX_RETRIES = 3;
export const SANDBOX_ROOT = Deno.env.get("VIBES_SANDBOX_ROOT") ?? "/tmp/vibes";
export const MAX_OUTPUT_CHARS = 50_000;
export const MAX_FILE_READ_BYTES = 200_000;
export const BASH_TIMEOUT_MS = 120_000;
