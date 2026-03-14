/**
 * Report formatting for experiment results.
 */

import type { ExperimentResult } from "./types.ts";

// ---------------------------------------------------------------------------
// formatReport
// ---------------------------------------------------------------------------

/**
 * Format an ExperimentResult as a human-readable text report.
 *
 * @example
 * ```ts
 * const result = await dataset.evaluate(task);
 * console.log(formatReport(result));
 * ```
 */
export function formatReport(result: ExperimentResult): string {
  const lines: string[] = [];

  // Header
  lines.push("=" .repeat(60));
  lines.push("Eval Report");
  lines.push("=" .repeat(60));
  lines.push(`Timestamp:      ${result.timestamp}`);
  lines.push(`Total Duration: ${result.totalDuration}ms`);
  lines.push(`Cases:          ${result.cases.length}`);

  const failures = result.cases.filter((c) => c.error !== undefined).length;
  if (failures > 0) {
    lines.push(`Failures:       ${failures}`);
  }

  // Summary table
  const evalNames = Object.keys(result.summary);
  if (evalNames.length > 0) {
    lines.push("");
    lines.push("-" .repeat(60));
    lines.push("Summary");
    lines.push("-" .repeat(60));

    const nameWidth = Math.max(
      "Evaluator".length,
      ...evalNames.map((n) => n.length),
    );

    const header = [
      "Evaluator".padEnd(nameWidth),
      "Mean".padStart(8),
      "Min".padStart(8),
      "Max".padStart(8),
      "PassRate".padStart(10),
    ].join("  ");
    lines.push(header);
    lines.push("-" .repeat(header.length));

    for (const name of evalNames) {
      const s = result.summary[name];
      const row = [
        name.padEnd(nameWidth),
        s.mean.toFixed(3).padStart(8),
        s.min.toFixed(3).padStart(8),
        s.max.toFixed(3).padStart(8),
        s.passRate !== undefined
          ? `${(s.passRate * 100).toFixed(1)}%`.padStart(10)
          : "".padStart(10),
      ].join("  ");
      lines.push(row);
    }
  }

  // Case details
  lines.push("");
  lines.push("-" .repeat(60));
  lines.push("Cases");
  lines.push("-" .repeat(60));

  for (let i = 0; i < result.cases.length; i++) {
    const c = result.cases[i];
    const caseName = c.case.name ?? `Case ${i + 1}`;
    const status = c.error !== undefined ? "FAIL" : "OK";
    lines.push(`[${status}] ${caseName} (${c.duration}ms)`);

    if (c.error !== undefined) {
      lines.push(`  Error: ${c.error.message}`);
    }

    for (const [evName, score] of Object.entries(c.scores)) {
      const scoreVal =
        typeof score.score === "boolean"
          ? score.score
            ? "pass"
            : "fail"
          : String(score.score);
      const reason = score.reason ? ` - ${score.reason}` : "";
      lines.push(`  ${evName}: ${scoreVal}${reason}`);
    }
  }

  lines.push("=" .repeat(60));

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// toJSON
// ---------------------------------------------------------------------------

/**
 * Serialize an ExperimentResult to a plain JSON-compatible object.
 *
 * Errors are converted to plain objects with message and name properties.
 */
export function toJSON(result: ExperimentResult): object {
  return {
    timestamp: result.timestamp,
    totalDuration: result.totalDuration,
    summary: result.summary,
    cases: result.cases.map((c) => ({
      case: {
        name: c.case.name,
        inputs: c.case.inputs,
        expectedOutput: c.case.expectedOutput,
        metadata: c.case.metadata,
      },
      output: c.output,
      error: c.error
        ? { name: c.error.name, message: c.error.message }
        : undefined,
      scores: c.scores,
      duration: c.duration,
      attributes: c.attributes,
      metrics: c.metrics,
    })),
  };
}
