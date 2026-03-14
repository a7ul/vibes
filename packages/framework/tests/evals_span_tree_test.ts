/**
 * evals_span_tree_test.ts
 *
 * Tests for SpanNode, SpanTree, and SpanData.
 */
import { assertEquals, assertExists } from "@std/assert";
import { SpanNode, SpanTree } from "../lib/evals/span_tree.ts";
import type { SpanData } from "../lib/evals/span_tree.ts";

function makeSpan(
  name: string,
  children: SpanData[] = [],
  status: SpanData["status"] = "ok",
): SpanData {
  const now = new Date();
  return {
    name,
    attributes: { key: name },
    durationMs: 10,
    startTime: now,
    endTime: new Date(now.getTime() + 10),
    status,
    events: [],
    children,
  };
}

Deno.test("SpanTree.fromSpanData - creates tree from flat root spans", () => {
  const data = [makeSpan("root1"), makeSpan("root2")];
  const tree = SpanTree.fromSpanData(data);
  assertEquals(tree.root.length, 2);
});

Deno.test("SpanTree.fromSpanData - preserves children", () => {
  const child = makeSpan("child");
  const parent = makeSpan("parent", [child]);
  const tree = SpanTree.fromSpanData([parent]);
  assertEquals(tree.root.length, 1);
  assertEquals(tree.root[0].children.length, 1);
  assertEquals(tree.root[0].children[0].name, "child");
});

Deno.test("SpanNode - parent reference is set on children", () => {
  const child = makeSpan("child");
  const parent = makeSpan("parent", [child]);
  const tree = SpanTree.fromSpanData([parent]);
  const parentNode = tree.root[0];
  const childNode = parentNode.children[0];
  assertExists(childNode.parent);
  assertEquals(childNode.parent!.name, "parent");
});

Deno.test("SpanNode - ancestors computed correctly", () => {
  const grandchild = makeSpan("grandchild");
  const child = makeSpan("child", [grandchild]);
  const root = makeSpan("root", [child]);
  const tree = SpanTree.fromSpanData([root]);

  const gc = tree.root[0].children[0].children[0];
  assertEquals(gc.ancestors.length, 2);
  assertEquals(gc.ancestors[0].name, "child");
  assertEquals(gc.ancestors[1].name, "root");
});

Deno.test("SpanNode - descendants computed correctly", () => {
  const grandchild = makeSpan("grandchild");
  const child = makeSpan("child", [grandchild]);
  const root = makeSpan("root", [child]);
  const tree = SpanTree.fromSpanData([root]);

  const rootNode = tree.root[0];
  assertEquals(rootNode.descendants.length, 2);
  const names = rootNode.descendants.map((n) => n.name).sort();
  assertEquals(names, ["child", "grandchild"]);
});

Deno.test("SpanNode - root node has undefined parent", () => {
  const tree = SpanTree.fromSpanData([makeSpan("root")]);
  assertEquals(tree.root[0].parent, undefined);
});

Deno.test("SpanTree.find - returns matching nodes", () => {
  const child = makeSpan("child");
  const root = makeSpan("root", [child]);
  const tree = SpanTree.fromSpanData([root]);
  const found = tree.find((n) => n.name === "child");
  assertEquals(found.length, 1);
  assertEquals(found[0].name, "child");
});

Deno.test("SpanTree.find - returns empty array if no match", () => {
  const tree = SpanTree.fromSpanData([makeSpan("root")]);
  const found = tree.find((n) => n.name === "nope");
  assertEquals(found.length, 0);
});

Deno.test("SpanTree.any - returns true if any node matches", () => {
  const child = makeSpan("needle");
  const root = makeSpan("root", [child]);
  const tree = SpanTree.fromSpanData([root]);
  assertEquals(tree.any((n) => n.name === "needle"), true);
  assertEquals(tree.any((n) => n.name === "missing"), false);
});

Deno.test("SpanTree.all - returns true only if every node matches", () => {
  const child = makeSpan("ok-child");
  const root = makeSpan("ok-root", [child]);
  const tree = SpanTree.fromSpanData([root]);

  assertEquals(tree.all((n) => n.status === "ok"), true);
  assertEquals(tree.all((n) => n.name === "ok-root"), false); // child does not match
});

Deno.test("SpanTree.count - returns number of matching nodes", () => {
  const child = makeSpan("child", [], "error");
  const root = makeSpan("root", [child], "ok");
  const tree = SpanTree.fromSpanData([root]);

  assertEquals(tree.count((n) => n.status === "error"), 1);
  assertEquals(tree.count((n) => n.status === "ok"), 1);
});

Deno.test("SpanTree - Symbol.iterator visits all nodes DFS", () => {
  const grandchild = makeSpan("gc");
  const child = makeSpan("child", [grandchild]);
  const root = makeSpan("root", [child]);
  const tree = SpanTree.fromSpanData([root]);

  const names: string[] = [];
  for (const node of tree) {
    names.push(node.name);
  }
  // DFS: root, child, gc
  assertEquals(names, ["root", "child", "gc"]);
});

Deno.test("SpanNode - attributes are accessible", () => {
  const span = makeSpan("root");
  const tree = SpanTree.fromSpanData([span]);
  assertEquals(tree.root[0].attributes["key"], "root");
});

Deno.test("SpanNode - durationMs is accessible", () => {
  const span = makeSpan("root");
  const tree = SpanTree.fromSpanData([span]);
  assertEquals(tree.root[0].durationMs, 10);
});

Deno.test("SpanNode is instance of SpanNode class", () => {
  const tree = SpanTree.fromSpanData([makeSpan("root")]);
  assertEquals(tree.root[0] instanceof SpanNode, true);
});
