/**
 * Tests for ExternalToolset - tools executed outside the agent process.
 * All tools require approval so the caller can execute them externally.
 */
import { assertEquals, assertInstanceOf } from "@std/assert";
import {
  Agent,
  ApprovalRequiredError,
  type DeferredToolResults,
  type ExternalToolDefinition,
  ExternalToolset,
} from "../mod.ts";
import {
  type DoGenerateResult,
  MockLanguageModelV3,
  mockValues,
  textResponse,
  toolCallResponse,
} from "./_helpers.ts";

const readFileDef: ExternalToolDefinition = {
  name: "read_file",
  description: "Read a file from the filesystem",
  jsonSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
    },
    required: ["path"],
  },
};

const writeFileDef: ExternalToolDefinition = {
  name: "write_file",
  description: "Write content to a file",
  jsonSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      content: { type: "string" },
    },
    required: ["path", "content"],
  },
};

Deno.test("ExternalToolset - exposes tools to model with requiresApproval", () => {
  const toolset = new ExternalToolset([readFileDef]);
  const ctx = {
    deps: undefined as undefined,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 },
    retryCount: 0,
    toolName: null,
    runId: "test",
    metadata: {},
    toolResultMetadata: new Map(),
    attachMetadata: () => {},
  };

  const tools = toolset.tools(ctx);
  assertEquals(tools.length, 1);
  assertEquals(tools[0].name, "read_file");
  assertEquals(tools[0].description, "Read a file from the filesystem");
  assertEquals(tools[0].requiresApproval, true);
});

Deno.test("ExternalToolset - model calling external tool throws ApprovalRequiredError", async () => {
  const toolset = new ExternalToolset([readFileDef]);
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("read_file", { path: "/etc/hosts" }, "tc-read"),
      ),
  });

  const agent = new Agent({ model, toolsets: [toolset] });

  let caught: ApprovalRequiredError | null = null;
  try {
    await agent.run("Read /etc/hosts");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) caught = err;
    else throw err;
  }

  assertInstanceOf(caught, ApprovalRequiredError);
  assertEquals(caught!.deferred.requests.length, 1);
  assertEquals(caught!.deferred.requests[0].toolName, "read_file");
  assertEquals(caught!.deferred.requests[0].args, { path: "/etc/hosts" });
});

Deno.test("ExternalToolset - caller executes externally, resume with result", async () => {
  const toolset = new ExternalToolset([readFileDef]);

  const firstCall = mockValues<DoGenerateResult>(
    toolCallResponse("read_file", { path: "/etc/hosts" }, "tc-read"),
  );
  const secondCall = mockValues<DoGenerateResult>(
    textResponse("File contents processed"),
  );
  let callCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? firstCall() : secondCall());
    },
  });

  const agent = new Agent({ model, toolsets: [toolset] });

  let deferredErr: ApprovalRequiredError | null = null;
  try {
    await agent.run("Read /etc/hosts");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) deferredErr = err;
    else throw err;
  }

  assertInstanceOf(deferredErr, ApprovalRequiredError);

  // Simulate external execution: read the file externally and provide result
  const externalResult = "127.0.0.1 localhost\n::1 localhost";
  const approvedResults: DeferredToolResults = {
    results: [
      {
        toolCallId: deferredErr!.deferred.requests[0].toolCallId,
        result: externalResult,
      },
    ],
  };

  const finalResult = await agent.resume(
    deferredErr!.deferred,
    approvedResults,
  );
  assertEquals(finalResult.output, "File contents processed");
  assertEquals(callCount, 2);
});

Deno.test("ExternalToolset - multiple external tools, one called", async () => {
  const toolset = new ExternalToolset([readFileDef, writeFileDef]);
  const model = new MockLanguageModelV3({
    doGenerate: () =>
      Promise.resolve(
        toolCallResponse("write_file", {
          path: "/tmp/out.txt",
          content: "hello",
        }),
      ),
  });

  const agent = new Agent({ model, toolsets: [toolset] });

  let caught: ApprovalRequiredError | null = null;
  try {
    await agent.run("Write hello to /tmp/out.txt");
  } catch (err) {
    if (err instanceof ApprovalRequiredError) caught = err;
    else throw err;
  }

  assertInstanceOf(caught, ApprovalRequiredError);
  assertEquals(caught!.deferred.requests[0].toolName, "write_file");
  assertEquals(caught!.deferred.requests[0].args, {
    path: "/tmp/out.txt",
    content: "hello",
  });
});

Deno.test("ExternalToolset - correct JSON schema passed to model", async () => {
  let capturedTools: unknown[] = [];
  const model = new MockLanguageModelV3({
    doGenerate: (opts) => {
      capturedTools = opts.tools ?? [];
      return Promise.resolve(textResponse("done"));
    },
  });

  const toolset = new ExternalToolset([readFileDef]);
  const agent = new Agent({ model, toolsets: [toolset] });
  await agent.run("do something");

  const readTool = (capturedTools as Array<{ name: string }>).find(
    (t) => t.name === "read_file",
  );
  assertEquals(readTool !== undefined, true);
});
