import {
  GoogleGenerativeAI,
  type GenerationConfig,
} from "@google/generative-ai";

// Gemini client — used server-side only. Never expose GEMINI_API_KEY to the browser.
let client: GoogleGenerativeAI | null = null;

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

export const GEMINI_MODEL = "gemini-2.0-flash-exp";
export const GEMINI_EMBEDDING_MODEL = "text-embedding-004";

export interface StructuredOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// Ask Gemini for a JSON object and parse it. Throws if the model returns
// malformed JSON or an empty response.
export async function generateStructured<T = unknown>(
  prompt: string,
  opts: StructuredOptions = {},
): Promise<T> {
  const genAI = getGeminiClient();
  const generationConfig: GenerationConfig = {
    responseMimeType: "application/json",
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
  };

  const model = genAI.getGenerativeModel({
    model: opts.model ?? GEMINI_MODEL,
    systemInstruction: opts.systemInstruction,
    generationConfig,
  });

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  if (!raw) throw new Error("Gemini returned an empty response");

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some model versions occasionally wrap JSON in ```json fences despite
    // responseMimeType. Strip once and retry.
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(stripped) as T;
  }
}

export async function embed(text: string): Promise<number[]> {
  const model = getGeminiClient().getGenerativeModel({
    model: GEMINI_EMBEDDING_MODEL,
  });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
