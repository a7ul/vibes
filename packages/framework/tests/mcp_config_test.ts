import { assertEquals, assertRejects } from "@std/assert";
import {
  createClientsFromConfig,
  loadMCPConfig,
  MCPHttpClient,
  MCPStdioClient,
} from "../mod.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTempFile(
  content: string,
  fn: (path: string) => Promise<void>,
): Promise<void> {
  const path = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(path, content);
    await fn(path);
  } finally {
    await Deno.remove(path).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// loadMCPConfig tests
// ---------------------------------------------------------------------------

Deno.test("loadMCPConfig - parses array of stdio configs", async () => {
  const config = JSON.stringify([
    { type: "stdio", command: "npx", args: ["-y", "my-server"] },
  ]);

  await withTempFile(config, async (path) => {
    const configs = await loadMCPConfig(path);
    assertEquals(configs.length, 1);
    assertEquals(configs[0].type, "stdio");
    if (configs[0].type === "stdio") {
      assertEquals(configs[0].command, "npx");
      assertEquals(configs[0].args, ["-y", "my-server"]);
    }
  });
});

Deno.test("loadMCPConfig - parses array of http configs", async () => {
  const config = JSON.stringify([
    {
      type: "http",
      url: "https://mcp.example.com",
      headers: { "X-API-Key": "abc" },
    },
  ]);

  await withTempFile(config, async (path) => {
    const loaded = await loadMCPConfig(path);
    assertEquals(loaded.length, 1);
    assertEquals(loaded[0].type, "http");
    if (loaded[0].type === "http") {
      assertEquals(loaded[0].url, "https://mcp.example.com");
      assertEquals(loaded[0].headers?.["X-API-Key"], "abc");
    }
  });
});

Deno.test("loadMCPConfig - parses Claude Desktop-style format", async () => {
  const config = JSON.stringify({
    mcpServers: {
      "file-server": {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      },
      "remote-server": {
        type: "http",
        url: "https://api.example.com/mcp",
      },
    },
  });

  await withTempFile(config, async (path) => {
    const configs = await loadMCPConfig(path);
    assertEquals(configs.length, 2);

    const fileServer = configs.find((c) => c.name === "file-server");
    assertEquals(fileServer?.type, "stdio");

    const remoteServer = configs.find((c) => c.name === "remote-server");
    assertEquals(remoteServer?.type, "http");
  });
});

Deno.test("loadMCPConfig - interpolates env vars", async () => {
  Deno.env.set("TEST_MCP_API_KEY", "my-secret-key");

  const config = JSON.stringify([
    {
      type: "http",
      url: "https://mcp.example.com",
      headers: { Authorization: "Bearer ${TEST_MCP_API_KEY}" },
    },
  ]);

  await withTempFile(config, async (path) => {
    const configs = await loadMCPConfig(path);
    if (configs[0].type === "http") {
      assertEquals(
        configs[0].headers?.["Authorization"],
        "Bearer my-secret-key",
      );
    }
  });

  Deno.env.delete("TEST_MCP_API_KEY");
});

Deno.test("loadMCPConfig - throws when env var not set", async () => {
  Deno.env.delete("NONEXISTENT_MCP_VAR");

  const config = JSON.stringify([
    { type: "http", url: "https://${NONEXISTENT_MCP_VAR}.example.com" },
  ]);

  await withTempFile(config, async (path) => {
    await assertRejects(
      () => loadMCPConfig(path),
      Error,
      "NONEXISTENT_MCP_VAR",
    );
  });
});

Deno.test("loadMCPConfig - throws on unknown type", async () => {
  const config = JSON.stringify([
    { type: "websocket", url: "ws://example.com" },
  ]);

  await withTempFile(config, async (path) => {
    await assertRejects(
      () => loadMCPConfig(path),
      Error,
      "websocket",
    );
  });
});

Deno.test("loadMCPConfig - throws on stdio missing command", async () => {
  const config = JSON.stringify([
    { type: "stdio" },
  ]);

  await withTempFile(config, async (path) => {
    await assertRejects(
      () => loadMCPConfig(path),
      Error,
      "command",
    );
  });
});

Deno.test("loadMCPConfig - throws on http missing url", async () => {
  const config = JSON.stringify([
    { type: "http" },
  ]);

  await withTempFile(config, async (path) => {
    await assertRejects(
      () => loadMCPConfig(path),
      Error,
      "url",
    );
  });
});

Deno.test("loadMCPConfig - throws on invalid file content", async () => {
  const config = '"just a string"';

  await withTempFile(config, async (path) => {
    await assertRejects(
      () => loadMCPConfig(path),
      Error,
    );
  });
});

// ---------------------------------------------------------------------------
// createClientsFromConfig tests
// ---------------------------------------------------------------------------

Deno.test("createClientsFromConfig - creates MCPStdioClient for stdio configs", () => {
  const configs = [
    { type: "stdio" as const, command: "npx", args: ["-y", "server"] },
  ];
  const clients = createClientsFromConfig(configs);
  assertEquals(clients.length, 1);
  assertEquals(clients[0] instanceof MCPStdioClient, true);
});

Deno.test("createClientsFromConfig - creates MCPHttpClient for http configs", () => {
  const configs = [
    { type: "http" as const, url: "https://mcp.example.com" },
  ];
  const clients = createClientsFromConfig(configs);
  assertEquals(clients.length, 1);
  assertEquals(clients[0] instanceof MCPHttpClient, true);
});

Deno.test("createClientsFromConfig - handles mixed configs", () => {
  const configs = [
    { type: "stdio" as const, command: "mcp-server", name: "local" },
    { type: "http" as const, url: "https://mcp.example.com", name: "remote" },
  ];
  const clients = createClientsFromConfig(configs);
  assertEquals(clients.length, 2);
  assertEquals(clients[0] instanceof MCPStdioClient, true);
  assertEquals(clients[1] instanceof MCPHttpClient, true);
});

Deno.test("createClientsFromConfig - creates no clients for empty array", () => {
  const clients = createClientsFromConfig([]);
  assertEquals(clients.length, 0);
});
