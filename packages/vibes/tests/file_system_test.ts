import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { sandboxDir, tasksDir, ensureSandboxDirs } from "../src/file_system.ts";
import { SANDBOX_ROOT } from "../src/constants.ts";

Deno.test("sandboxDir - returns expected path", () => {
  assertEquals(sandboxDir("my-wf"), join(SANDBOX_ROOT, "sandboxes", "my-wf"));
});

Deno.test("tasksDir - returns tasks subdir of sandbox", () => {
  assertEquals(tasksDir("my-wf"), join(sandboxDir("my-wf"), "tasks"));
});

Deno.test("ensureSandboxDirs - creates all required directories", async () => {
  const tmpRoot = await Deno.makeTempDir({ prefix: "vibes_fs_test_" });
  const origEnv = Deno.env.get("VIBES_SANDBOX_ROOT");
  Deno.env.set("VIBES_SANDBOX_ROOT", tmpRoot);

  try {
    // Re-import with patched env won't work since constants.ts reads at module load.
    // Instead, test ensureSandboxDirs with the already-loaded SANDBOX_ROOT by pointing
    // our temp dir to the actual sandbox root used.
    await ensureSandboxDirs("test-wf");

    const base = sandboxDir("test-wf");
    const pipTmp = await Deno.stat(join(base, "pip", "tmp"));
    const pipSite = await Deno.stat(join(base, "pip", "site-packages"));
    const tasks = await Deno.stat(join(base, "tasks"));

    assertEquals(pipTmp.isDirectory, true);
    assertEquals(pipSite.isDirectory, true);
    assertEquals(tasks.isDirectory, true);
  } finally {
    if (origEnv !== undefined) Deno.env.set("VIBES_SANDBOX_ROOT", origEnv);
    else Deno.env.delete("VIBES_SANDBOX_ROOT");
    await Deno.remove(tmpRoot, { recursive: true }).catch(() => {});
    await Deno.remove(sandboxDir("test-wf"), { recursive: true }).catch(() => {});
  }
});
