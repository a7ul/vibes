/**
 * Build script: produces an npm-compatible package in ./npm/
 *
 * Run: deno run -A scripts/build_npm.ts
 * Publish: cd npm && npm publish --access public
 */
import { build, emptyDir } from "jsr:@deno/dnt@^0.41";

const version = Deno.args[0] ?? "0.1.0";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  importMap: "./deno.json",
  shims: {
    // Shim Deno globals (Deno.readTextFile, Deno.writeTextFile, Deno.env, etc.)
    deno: true,
  },
  // Run the test suite in Node after build
  test: false, // tests use Deno.test — skip for now
  package: {
    name: "@vibes/framework",
    version,
    description:
      "pydantic-ai patterns for TypeScript. Powered by Vercel AI SDK.",
    license: "MIT",
    keywords: [
      "ai",
      "agent",
      "llm",
      "pydantic-ai",
      "vercel-ai-sdk",
      "typescript",
      "framework",
    ],
    engines: {
      node: ">=18",
    },
    peerDependencies: {
      ai: "^6.0.0",
      zod: "^4.0.0",
    },
    peerDependenciesMeta: {
      ai: { optional: false },
      zod: { optional: false },
    },
    dependencies: {
      "@modelcontextprotocol/sdk": "^1.0.0",
      "@opentelemetry/api": "^1.0.0",
    },
  },
  compilerOptions: {
    lib: ["ES2022", "DOM"],
    target: "ES2022",
  },
  // Map Deno-only imports to npm equivalents
  mappings: {
    "npm:ai@^6": {
      name: "ai",
      version: "^6.0.0",
      peerDependency: true,
    },
    "npm:ai@^6/test": {
      name: "ai",
      subPath: "test",
      version: "^6.0.0",
      peerDependency: true,
    },
    "npm:zod@^4": {
      name: "zod",
      version: "^4.0.0",
      peerDependency: true,
    },
    "npm:@ai-sdk/provider@^3.0.0-0": {
      name: "@ai-sdk/provider",
      version: "^3.0.0-0",
    },
    "npm:@modelcontextprotocol/sdk@^1": {
      name: "@modelcontextprotocol/sdk",
      version: "^1.0.0",
    },
    "npm:@opentelemetry/api@^1": {
      name: "@opentelemetry/api",
      version: "^1.0.0",
    },
  },
  postBuild() {
    Deno.copyFileSync("README.md", "npm/README.md");
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
  },
});

console.log("\n✓ npm package built in ./npm/");
console.log("  To publish: cd npm && npm publish --access public");
