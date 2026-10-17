// The ONE place the app talks to the AI: Google Gemini. Every AI feature goes through
// generateJSON(). Gemini is called through its OpenAI-compatible endpoint with the
// standard `openai` package, from the server only.
//
// Settings (.env.local, and in Vercel):
//   GEMINI_API_KEY  the key from https://aistudio.google.com/apikey (server-side only;
//                   never sent to the browser)
//   GEMINI_MODEL    optional. A comma-separated list is tried in order: if a model is busy
//                   or not allowed for this key, the next one is used.
//                   Default: "gemini-3-flash-preview,gemini-3.1-flash-lite"
// (AI_API_KEY / AI_MODEL, the earlier names, are still read so an existing setup keeps working.)
//
// Notes (checked 2026-10-13):
//   - reasoning_effort "none" turns thinking off on 2.5 models; Gemini 3 models can only
//     go down to "minimal".
//   - We ask for JSON (response_format json_object, plus the word "json" and an example in
//     the prompt), use a low temperature, and retry once if the answer is unusable.

import "server-only";
import OpenAI from "openai";

export class AiError extends Error {
  constructor(
    public code: "not_configured" | "no_credit" | "bad_key" | "bad_output" | "request_failed",
    message: string
  ) {
    super(message);
  }
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEFAULT_MODELS = "gemini-3-flash-preview,gemini-3.1-flash-lite";

function settings() {
  return {
    apiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY,
    // GEMINI_BASE_URL is only set by the offline test (scripts/test-ai.mts).
    baseURL: process.env.GEMINI_BASE_URL || GEMINI_BASE_URL,
    model: process.env.GEMINI_MODEL || process.env.AI_MODEL || DEFAULT_MODELS,
  };
}

// Switch Gemini's "thinking" down (faster, and temperature works).
function geminiOptions(model: string): Record<string, unknown> {
  return { reasoning_effort: model.includes("2.5") ? "none" : "minimal" };
}

// Gets the JSON object out of an answer, even if the model wrapped it in ```json fences.
function extractJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object found");
    return JSON.parse(content.slice(start, end + 1));
  }
}

let client: OpenAI | null = null;
let clientKey = "";

function getClient(): { openai: OpenAI; models: string[]; baseURL: string } {
  const { apiKey, baseURL, model } = settings();
  if (!apiKey) throw new AiError("not_configured", "GEMINI_API_KEY is not set in .env.local");
  if (!client || clientKey !== apiKey + baseURL) {
    client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });
    clientKey = apiKey + baseURL;
  }
  const models = model.split(",").map((m) => m.trim()).filter(Boolean);
  return { openai: client, models, baseURL };
}

// Sends a system + user prompt and returns parsed JSON that passes `isValid`.
// Tries twice; throws AiError if both answers are unusable.
export async function generateJSON<T>({
  system,
  user,
  isValid,
  maxTokens = 4000,
  temperature = 0.2,
}: {
  system: string;
  user: string;
  isValid: (value: unknown) => value is T;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const { openai, models, baseURL } = getClient();
  let lastError: AiError = new AiError("request_failed", "The AI service did not respond");

  // Try each model in turn. Problems with the whole account (no credit, bad key) stop at once.
  for (const model of models) {
    try {
      return await askModel(openai, baseURL, model, { system, user, isValid, maxTokens, temperature });
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      if (err.code === "no_credit" || err.code === "bad_key") throw err;
      console.error(`AI model ${model} unavailable (${err.code}); trying the next one if any`);
      lastError = err;
    }
  }
  throw lastError;
}

// One model: up to two attempts (a second try helps with empty or broken JSON answers).
async function askModel<T>(
  openai: OpenAI,
  baseURL: string,
  model: string,
  {
    system,
    user,
    isValid,
    maxTokens,
    temperature,
  }: { system: string; user: string; isValid: (value: unknown) => value is T; maxTokens: number; temperature: number }
): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let content: string | null | undefined;
    try {
      const params = {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
        temperature,
        ...geminiOptions(model),
      };
      const completion = await openai.chat.completions.create(
        params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );
      // Only ever use `content`. Some providers also return hidden reasoning
      // (e.g. `reasoning_content`); it must never be shown to users or parsed as the answer.
      content = completion.choices[0]?.message?.content;
    } catch (err) {
      const status = (err as { status?: number }).status;
      console.error(`AI request to ${model} failed (attempt ${attempt}, status ${status ?? "none"}):`, (err as Error).message.slice(0, 200));
      // Retrying cannot fix these, so stop straight away with a clear reason.
      if (status === 402) throw new AiError("no_credit", "The AI account has no credit left (402)");
      if (status === 401) throw new AiError("bad_key", "The AI API key was refused");
      // Not allowed / not found / not supported / busy: this model won't work now, try the next model.
      if (status === 403 || status === 404 || status === 400 || status === 429 || status === 503) {
        throw new AiError("request_failed", `Model ${model} unavailable (${status})`);
      }
      if (attempt === 2) throw new AiError("request_failed", "The AI service did not respond");
      continue;
    }

    try {
      const parsed = extractJson(content ?? "");
      if (isValid(parsed)) return parsed;
      console.error(`AI answer had missing keys (attempt ${attempt})`);
    } catch {
      console.error(`AI answer was not valid JSON (attempt ${attempt})`);
    }
  }
  throw new AiError("bad_output", "The AI answer could not be used");
}
