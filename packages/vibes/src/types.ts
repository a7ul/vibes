import { z } from "zod";

export interface CoreAgentDeps {
  workflowId: string;
  contextDir: string;
  runId: string;
}

export const CoreAgentOutputSchema = z.object({
  taskStatus: z.enum(["completed", "failed"]),
  taskSummary: z.string(),
});

export type CoreAgentOutput = z.infer<typeof CoreAgentOutputSchema>;
