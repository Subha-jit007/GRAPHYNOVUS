import {
  GoogleGenerativeAI,
  type GenerationConfig,
} from "@google/generative-ai";

// Gemini client — used server-side only. Never expose GEMINI_API_KEY to the browser.
let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("[gemini] GEMINI_API_KEY is not set in environment variables");
    throw new Error("GEMINI_API_KEY is not configured. Add it to Vercel → Settings → Environment Variables.");
  }
  if (!client) {
    console.log(`[gemini] Initialising client (key ...${key.slice(-4)})`);
    client = new GoogleGenerativeAI(key);
  }
  return client;
}

// gemini-2.0-flash-exp was deprecated; gemini-2.0-flash is the stable GA replacement.
export const GEMINI_MODEL = "gemini-2.0-flash";
export const GEMINI_EMBEDDING_MODEL = "text-embedding-004";

export interface StructuredOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

// Hard cap so a slow/hung Gemini call never eats the full Vercel maxDuration.
// 25 s gives ample room under the 60 s function limit while aborting early
// enough to return a useful error to the client.
const GEMINI_TIMEOUT_MS = 25_000;

// Ask Gemini for a JSON object and parse it. Throws if the model returns
// malformed JSON or an empty response.
export async function generateStructured<T = unknown>(
  prompt: string,
  opts: StructuredOptions = {},
): Promise<T> {
  const modelName = opts.model ?? GEMINI_MODEL;
  console.log(`[gemini] generateStructured — model: ${modelName}, prompt length: ${prompt.length}`);

  const genAI = getGeminiClient();
  const generationConfig: GenerationConfig = {
    responseMimeType: "application/json",
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
  };

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: opts.systemInstruction,
    generationConfig,
  });

  let result;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s`)),
        GEMINI_TIMEOUT_MS,
      ),
    );
    result = await Promise.race([model.generateContent(prompt), timeout]);
  } catch (err) {
    console.error("[gemini] generateContent threw:", err);
    throw err;
  }

  const raw = result.response.text().trim();
  console.log(`[gemini] response length: ${raw.length}, first 120 chars: ${raw.slice(0, 120)}`);

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
    try {
      return JSON.parse(stripped) as T;
    } catch (parseErr) {
      console.error("[gemini] JSON parse failed. Raw response:\n", raw);
      throw new Error(`Gemini returned non-JSON response: ${String(parseErr)}`);
    }
  }
}

export async function embed(text: string): Promise<number[]> {
  const model = getGeminiClient().getGenerativeModel({
    model: GEMINI_EMBEDDING_MODEL,
  });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
