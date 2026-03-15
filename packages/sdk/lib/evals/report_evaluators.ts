/**
 * Report-level evaluators for the Vibes evaluation framework.
 *
 * These evaluators operate on the full set of CaseResults after an experiment
 * completes, computing aggregate metrics like confusion matrices, precision/recall,
 * ROC AUC, and KS statistics.
 */

import type { CaseResult, EvalScore, ReportEvaluator } from "./types.ts";

// ---------------------------------------------------------------------------
// confusionMatrix
// ---------------------------------------------------------------------------

/**
 * Computes a confusion matrix for classification tasks.
 *
 * The score is a formatted string summary of TP/TN/FP/FN counts per class.
 */
export function confusionMatrix(options: {
  getLabel: (result: CaseResult) => string;
  getExpected: (result: CaseResult) => string;
}): ReportEvaluator {
  return {
    name: "confusionMatrix",
    evaluate(results: CaseResult[]): EvalScore {
      // Collect all unique class labels
      const classes = new Set<string>();
      const pairs: Array<{ predicted: string; expected: string }> = [];

      for (const result of results) {
        const predicted = options.getLabel(result);
        const expected = options.getExpected(result);
        classes.add(predicted);
        classes.add(expected);
        pairs.push({ predicted, expected });
      }

      const classArray = [...classes].sort();

      // Build confusion matrix: matrix[expected][predicted]
      const matrix: Record<string, Record<string, number>> = {};
      for (const cls of classArray) {
        matrix[cls] = {};
        for (const cls2 of classArray) {
          matrix[cls][cls2] = 0;
        }
      }

      for (const { predicted, expected } of pairs) {
        matrix[expected][predicted]++;
      }

      // Format as a readable string
      const header = [""].concat(classArray).join("\t");
      const rows = classArray
        .map((exp) => {
          const counts = classArray.map((pred) => matrix[exp][pred]);
          return [exp, ...counts].join("\t");
        })
        .join("\n");

      const summary = `Confusion Matrix (rows=expected, cols=predicted):\n${header}\n${rows}`;

      return {
        score: summary,
        reason: summary,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// precisionRecall
// ---------------------------------------------------------------------------

/**
 * Computes precision and recall for binary classification tasks.
 *
 * - Precision = TP / (TP + FP)
 * - Recall    = TP / (TP + FN)
 *
 * Returns the F1 score (harmonic mean of precision and recall) as the numeric score.
 */
export function precisionRecall(options: {
  getPositive: (result: CaseResult) => boolean;
  getExpected: (result: CaseResult) => boolean;
}): ReportEvaluator {
  return {
    name: "precisionRecall",
    evaluate(results: CaseResult[]): EvalScore {
      let tp = 0;
      let fp = 0;
      let fn = 0;

      for (const result of results) {
        const predicted = options.getPositive(result);
        const expected = options.getExpected(result);

        if (predicted && expected) tp++;
        else if (predicted && !expected) fp++;
        else if (!predicted && expected) fn++;
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 =
        precision + recall > 0
          ? (2 * precision * recall) / (precision + recall)
          : 0;

      const reason =
        `precision=${precision.toFixed(2)}, recall=${recall.toFixed(2)}, f1=${f1.toFixed(2)}, ` +
        `TP=${tp}, FP=${fp}, FN=${fn}`;

      return {
        score: f1,
        reason,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// rocAuc
// ---------------------------------------------------------------------------

/**
 * Computes the ROC AUC (Area Under the Receiver Operating Characteristic Curve)
 * for binary classification.
 *
 * Uses the trapezoidal rule (equivalent to the Wilcoxon rank-sum statistic).
 */
export function rocAuc(options: {
  getScore: (result: CaseResult) => number;
  getLabel: (result: CaseResult) => boolean;
}): ReportEvaluator {
  return {
    name: "rocAuc",
    evaluate(results: CaseResult[]): EvalScore {
      const scored = results.map((r) => ({
        score: options.getScore(r),
        label: options.getLabel(r),
      }));

      // Separate positives and negatives
      const positives = scored.filter((s) => s.label).map((s) => s.score);
      const negatives = scored.filter((s) => !s.label).map((s) => s.score);

      if (positives.length === 0 || negatives.length === 0) {
        return {
          score: 0.5,
          reason: "cannot compute ROC AUC: need both positive and negative examples",
        };
      }

      // AUC = P(score_positive > score_negative)
      // Use the Wilcoxon rank-sum / Mann-Whitney U statistic
      let concordant = 0;
      let tied = 0;
      const total = positives.length * negatives.length;

      for (const pos of positives) {
        for (const neg of negatives) {
          if (pos > neg) concordant++;
          else if (pos === neg) tied++;
        }
      }

      const auc = (concordant + tied * 0.5) / total;

      return {
        score: auc,
        reason: `ROC AUC = ${auc.toFixed(4)} (${positives.length} positives, ${negatives.length} negatives)`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// kolmogorovSmirnov
// ---------------------------------------------------------------------------

/**
 * Computes the Kolmogorov-Smirnov statistic between two score distributions.
 *
 * The KS statistic measures the maximum absolute difference between the
 * empirical CDFs of the two distributions. Returns a value in [0, 1].
 */
export function kolmogorovSmirnov(options: {
  getScoreA: (result: CaseResult, index: number) => number;
  getScoreB: (result: CaseResult, index: number) => number;
}): ReportEvaluator {
  return {
    name: "kolmogorovSmirnov",
    evaluate(results: CaseResult[]): EvalScore {
      const scoresA = results.map((r, i) => options.getScoreA(r, i));
      const scoresB = results.map((r, i) => options.getScoreB(r, i));

      const ks = computeKS(scoresA, scoresB);

      return {
        score: ks,
        reason: `KS statistic = ${ks.toFixed(4)}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: KS statistic computation
// ---------------------------------------------------------------------------

/** Compute the two-sample KS statistic between two arrays of numbers. */
function computeKS(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);

  // Collect all unique values
  const allValues = [...new Set([...sortedA, ...sortedB])].sort(
    (x, y) => x - y,
  );

  let maxDiff = 0;
  let indexA = 0;
  let indexB = 0;

  for (const val of allValues) {
    // Advance pointers past all values <= val
    while (indexA < sortedA.length && sortedA[indexA] <= val) indexA++;
    while (indexB < sortedB.length && sortedB[indexB] <= val) indexB++;

    const cdfA = indexA / sortedA.length;
    const cdfB = indexB / sortedB.length;
    const diff = Math.abs(cdfA - cdfB);

    if (diff > maxDiff) maxDiff = diff;
  }

  return maxDiff;
}
