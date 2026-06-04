import OpenAI from "openai";

export type StructuredAIRequest = { system: string; user: string; schemaName: string; model?: string };
export type StructuredAIResponse = { model: string; rawText: string; json: unknown; parseError?: string };
export interface AIProvider { name: string; runStructured(request: StructuredAIRequest): Promise<StructuredAIResponse>; }

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  async runStructured(request: StructuredAIRequest): Promise<StructuredAIResponse> {
    const model = request.model ?? process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini";
    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: "system", content: `${request.system}\nReturn valid JSON only for ${request.schemaName}. Do not include markdown fences, prose, or commentary outside the JSON object.` }, { role: "user", content: request.user }],
      response_format: { type: "json_object" }
    });
    const rawText = response.choices[0]?.message.content ?? "{}";
    try {
      return { model, rawText, json: JSON.parse(rawText) };
    } catch (error) {
      const parseError = error instanceof Error ? error.message : "Structured JSON parse failed";
      return { model, rawText, json: null, parseError };
    }
  }
}
export function getAIProvider(): AIProvider { return new OpenAIProvider(); }
