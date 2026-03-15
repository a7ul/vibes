import { Agent, BaseNode, Graph, next, output } from "../mod.ts";
import { anthropic } from "npm:@ai-sdk/anthropic";

type PipelineState = {
  topic: string;
  outline?: string;
  article?: string;
};

const outlineAgent = new Agent({
  model: anthropic("claude-haiku-4-5-20251001"),
  systemPrompt: "Create a concise 3-point outline for a short article. Return only the outline.",
});

const writeAgent = new Agent({
  model: anthropic("claude-sonnet-4-6"),
  systemPrompt: "Write a short 3-paragraph article based on the outline provided.",
});

class OutlineNode extends BaseNode<PipelineState, string> {
  readonly id = "outline";

  async run(state: PipelineState) {
    const result = await outlineAgent.run(`Create an outline for: ${state.topic}`);
    return next<PipelineState, string>("write", { ...state, outline: result.output });
  }
}

class WriteNode extends BaseNode<PipelineState, string> {
  readonly id = "write";

  async run(state: PipelineState) {
    const result = await writeAgent.run(
      `Outline:\n${state.outline}\n\nWrite the article.`
    );
    return output<PipelineState, string>(result.output);
  }
}

const graph = new Graph<PipelineState, string>([
  new OutlineNode(),
  new WriteNode(),
]);

const article = await graph.run({ topic: "The future of AI agents" }, "outline");
console.log(article);
