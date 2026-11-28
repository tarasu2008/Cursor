import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { GuardrailError, parsePublicUrl } from "../lib/guardrails";
import { CHECK_PASSAGES } from "./knowledge";

const forbiddenIntent = z.enum(["pay", "fill_checkout", "credit_card", "submit_payment", "delete"]);

export const agentResultSchema = z.object({
  url: z.string(),
  allowed: z.boolean(),
  refusal: z.string().nullable(),
  passages: z.array(z.string()),
  reasoning: z.string(),
  forbidden: z.array(forbiddenIntent),
});

export type AgentResult = z.infer<typeof agentResultSchema>;

const INTENTS: { id: z.infer<typeof forbiddenIntent>; pattern: RegExp }[] = [
  { id: "fill_checkout", pattern: /fill(?:\s+in)?\s+checkout|type\s+guest|guest details/i },
  { id: "credit_card", pattern: /credit\s*card|card number|cvv|cvc/i },
  { id: "submit_payment", pattern: /submit payment|place order|complete purchase/i },
  { id: "pay", pattern: /\bpay\b|\bpayment\b/i },
  { id: "delete", pattern: /\bdelete\b/i },
];

const AgentState = Annotation.Root({
  request: Annotation<string>,
  url: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  blocked: Annotation<string | null>({ reducer: (_left, right) => right, default: () => null }),
  passages: Annotation<string[]>({ reducer: (_left, right) => right, default: () => [] }),
  reasoning: Annotation<string>({ reducer: (_left, right) => right, default: () => "" }),
  forbidden: Annotation<z.infer<typeof forbiddenIntent>[]>({ reducer: (_left, right) => right, default: () => [] }),
  output: Annotation<AgentResult | null>({ reducer: (_left, right) => right, default: () => null }),
});

function intentsIn(text: string): z.infer<typeof forbiddenIntent>[] {
  return INTENTS.filter((item) => item.pattern.test(text)).map((item) => item.id);
}

function firstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.;]+$/, "") : null;
}

async function inputGuardrail(state: typeof AgentState.State) {
  const forbidden = intentsIn(state.request);
  const rawUrl = firstUrl(state.request) || state.request.trim();
  if (forbidden.length > 0) {
    return {
      url: rawUrl,
      blocked: `Refusing ${forbidden.join(", ")}. Booking may be opened until checkout and must stop there.`,
      forbidden,
    };
  }
  try {
    const url = parsePublicUrl(rawUrl);
    return { url: url.toString(), blocked: null, forbidden };
  } catch (error) {
    const message = error instanceof GuardrailError ? error.message : "The address was refused.";
    return { url: rawUrl, blocked: message, forbidden };
  }
}

async function ragRetrieval(state: typeof AgentState.State) {
  const words = new Set(state.request.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  const ranked = CHECK_PASSAGES.map((passage) => {
    const hits = passage
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => words.has(word)).length;
    return { passage, hits };
  })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 4)
    .map((item) => item.passage);
  return { passages: ranked.length > 0 ? ranked : CHECK_PASSAGES.slice(0, 3) };
}

async function playwrightReasoning(state: typeof AgentState.State) {
  const local = `Playwright specs run without a model. Next safe step: open ${state.url}, record the homepage checks, and stop when the checkout page is reached.`;
  if (!process.env.GROQ_API_KEY) {
    return { reasoning: local };
  }
  try {
    const { ChatGroq } = await import("@langchain/groq");
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0,
    });
    const response = await model.invoke([
      {
        role: "system",
        content:
          "You plan one Playwright step. Never pay, fill checkout, type a credit card, submit payment, or delete. Booking may be walked until the checkout page and must stop there.",
      },
      { role: "user", content: `${state.request}\n\n${state.passages.join("\n")}` },
    ]);
    const text = typeof response.content === "string" ? response.content : local;
    return { reasoning: text.slice(0, 500) };
  } catch {
    return { reasoning: local };
  }
}

async function outputGuardrail(state: typeof AgentState.State) {
  const leaked = state.reasoning
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !/\b(do not|don't|never|without|must stop|refusing|not activated)\b/i.test(sentence))
    .flatMap((sentence) => intentsIn(sentence));
  const forbidden = [...new Set([...state.forbidden, ...leaked])];
  const blocked = state.blocked || (leaked.length > 0 ? `The plan included ${leaked.join(", ")} and was refused.` : null);
  const output = agentResultSchema.parse({
    url: state.url,
    allowed: !blocked,
    refusal: blocked,
    passages: state.passages,
    reasoning: blocked ? "" : state.reasoning,
    forbidden,
  });
  return { output };
}

const graph = new StateGraph(AgentState)
  .addNode("input_guardrail", inputGuardrail)
  .addNode("rag_retrieval", ragRetrieval)
  .addNode("playwright_reasoning", playwrightReasoning)
  .addNode("output_guardrail", outputGuardrail)
  .addEdge(START, "input_guardrail")
  .addConditionalEdges("input_guardrail", (state) => (state.blocked ? "output_guardrail" : "rag_retrieval"))
  .addEdge("rag_retrieval", "playwright_reasoning")
  .addEdge("playwright_reasoning", "output_guardrail")
  .addEdge("output_guardrail", END)
  .compile();

export async function runQaAgent(request: string): Promise<AgentResult> {
  const result = await graph.invoke({ request });
  return agentResultSchema.parse(result.output);
}
