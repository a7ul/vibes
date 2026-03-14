import { z } from "zod";

export interface CoreAgentDeps {
  workflowId: string;
  contextDir: string;
  runId: string;
}

export type CoreAgentOutput = {
  taskStatus: "completed" | "failed";
  taskSummary: string;
};

export const CoreAgentOutputSchema: z.ZodType<CoreAgentOutput> = z.object({
  taskStatus: z.enum(["completed", "failed"]),
  taskSummary: z.string(),
});
