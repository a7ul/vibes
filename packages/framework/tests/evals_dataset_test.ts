/**
 * evals_dataset_test.ts
 *
 * Tests for Dataset class: factory methods, manipulation, iteration.
 */
import {
  assertEquals,
  assertExists,
  assertThrows,
} from "@std/assert";
import { Dataset } from "../lib/evals/dataset.ts";
import type { Case } from "../lib/evals/types.ts";

const sampleCases: Case<string, string>[] = [
  { name: "c1", inputs: "hello", expectedOutput: "world" },
  { name: "c2", inputs: "foo", expectedOutput: "bar" },
];

// ---------------------------------------------------------------------------
// fromArray
// ---------------------------------------------------------------------------

Deno.test("Dataset.fromArray - creates dataset with correct cases", () => {
  const ds = Dataset.fromArray(sampleCases);
  assertEquals(ds.cases.length, 2);
  assertEquals(ds.cases[0].inputs, "hello");
});

Deno.test("Dataset.fromArray - is immutable (cases is ReadonlyArray)", () => {
  const ds = Dataset.fromArray(sampleCases);
  // Frozen array throws on mutation at runtime
  assertThrows(() => {
    (ds.cases as unknown as Case<string, string>[]).push({ inputs: "x" });
  });
});

Deno.test("Dataset.fromArray - name is undefined by default", () => {
  const ds = Dataset.fromArray(sampleCases);
  assertEquals(ds.name, undefined);
});

Deno.test("Dataset.fromArray - name set when provided", () => {
  const ds = Dataset.fromArray(sampleCases, { name: "my-ds" });
  assertEquals(ds.name, "my-ds");
});

Deno.test("Dataset.fromArray - evaluators stored", () => {
  const ev = { name: "noop", evaluate: () => ({ score: true }) };
  const ds = Dataset.fromArray(sampleCases, { evaluators: [ev] });
  assertEquals(ds.evaluators.length, 1);
  assertEquals(ds.evaluators[0].name, "noop");
});

// ---------------------------------------------------------------------------
// fromJSON
// ---------------------------------------------------------------------------

Deno.test("Dataset.fromJSON - parses JSON string", () => {
  const json = JSON.stringify(sampleCases);
  const ds = Dataset.fromJSON<string, string>(json);
  assertEquals(ds.cases.length, 2);
});

Deno.test("Dataset.fromJSON - parses JSON object (array)", () => {
  const ds = Dataset.fromJSON<string, string>(sampleCases);
  assertEquals(ds.cases.length, 2);
});

Deno.test("Dataset.fromJSON - parses JSON object with cases key", () => {
  const obj = { cases: sampleCases };
  const ds = Dataset.fromJSON<string, string>(obj);
  assertEquals(ds.cases.length, 2);
});

// ---------------------------------------------------------------------------
// fromText
// ---------------------------------------------------------------------------

Deno.test("Dataset.fromText - JSON format", () => {
  const text = JSON.stringify(sampleCases);
  const ds = Dataset.fromText<string, string>(text, "json");
  assertEquals(ds.cases.length, 2);
});

// ---------------------------------------------------------------------------
// toJSON
// ---------------------------------------------------------------------------

Deno.test("Dataset.toJSON - round-trips correctly", () => {
  const ds = Dataset.fromArray(sampleCases, { name: "round-trip" });
  const json = ds.toJSON();
  assertExists(json);
  const ds2 = Dataset.fromJSON<string, string>(json);
  assertEquals(ds2.cases.length, 2);
  assertEquals(ds2.cases[0].inputs, "hello");
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

Deno.test("Dataset.filter - returns new dataset (immutable)", () => {
  const ds = Dataset.fromArray(sampleCases);
  const filtered = ds.filter((c) => c.inputs === "hello");
  assertEquals(filtered.cases.length, 1);
  assertEquals(ds.cases.length, 2); // original unchanged
});

Deno.test("Dataset.filter - keeps evaluators", () => {
  const ev = { name: "noop", evaluate: () => ({ score: true }) };
  const ds = Dataset.fromArray(sampleCases, { evaluators: [ev] });
  const filtered = ds.filter(() => true);
  assertEquals(filtered.evaluators.length, 1);
});

// ---------------------------------------------------------------------------
// map
// ---------------------------------------------------------------------------

Deno.test("Dataset.map - transforms cases immutably", () => {
  const ds = Dataset.fromArray(sampleCases);
  const mapped = ds.map((c) => ({ ...c, inputs: c.inputs.toUpperCase() }));
  assertEquals(mapped.cases[0].inputs, "HELLO");
  assertEquals(ds.cases[0].inputs, "hello"); // original unchanged
});

Deno.test("Dataset.map - can change types", () => {
  const ds = Dataset.fromArray(sampleCases);
  const mapped = ds.map<number, number>((c) => ({
    inputs: c.inputs.length,
    expectedOutput: (c.expectedOutput ?? "").length,
  }));
  assertEquals(mapped.cases[0].inputs, 5); // "hello".length
});

// ---------------------------------------------------------------------------
// Symbol.iterator
// ---------------------------------------------------------------------------

Deno.test("Dataset - iteration works", () => {
  const ds = Dataset.fromArray(sampleCases);
  const names: string[] = [];
  for (const c of ds) {
    names.push(c.name ?? "");
  }
  assertEquals(names, ["c1", "c2"]);
});

// ---------------------------------------------------------------------------
// Per-case evaluators
// ---------------------------------------------------------------------------

Deno.test("Dataset - per-case evaluators stored", () => {
  const ev = { name: "case-eval", evaluate: () => ({ score: true }) };
  const casesWithEv: Case<string, string>[] = [
    { inputs: "hi", evaluators: [ev] },
  ];
  const ds = Dataset.fromArray(casesWithEv);
  assertEquals(ds.cases[0].evaluators?.length, 1);
});
