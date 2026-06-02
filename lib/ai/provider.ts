import OpenAI from "openai";

export type StructuredAIRequest = { system: string; user: string; schemaName: string; model?: string };
export type StructuredAIResponse = { model: string; rawText: string; json: unknown };
export interface AIProvider { name: string; runStructured(request: StructuredAIRequest): Promise<StructuredAIResponse>; }

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  async runStructured(request: StructuredAIRequest): Promise<StructuredAIResponse> {
    const model = request.model ?? process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini";
    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: "system", content: `${request.system}\nReturn only valid JSON for ${request.schemaName}.` }, { role: "user", content: request.user }],
      response_format: { type: "json_object" }
    });
    const rawText = response.choices[0]?.message.content ?? "{}";
    return { model, rawText, json: JSON.parse(rawText) };
  }
}
export function getAIProvider(): AIProvider { return new OpenAIProvider(); }
