// The ONE place the app talks to an AI model. Every AI feature goes through
// generateJSON(), so the provider can be swapped by changing .env.local only.
//
// Any OpenAI-compatible provider works, through the standard `openai` package:
//   AI_API_KEY   the provider's key (server-side only; never sent to the browser)
//   AI_BASE_URL  e.g. https://generativelanguage.googleapis.com/v1beta/openai/  (Google Gemini)
//                or   https://api.deepseek.com                                  (DeepSeek)
//   AI_MODEL     e.g. gemini-2.5-flash  or  deepseek-flash
// The older DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL still work if AI_API_KEY is empty.
//
// Provider notes (checked 2026-10-13):
//   - Gemini (OpenAI-compatible endpoint): reasoning_effort "none" turns thinking off on
//     2.5 models; Gemini 3 models can only go down to "minimal".
//   - DeepSeek: thinking is on by default; thinking: { type: "disabled" } turns it off.
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

function settings() {
  const useGeneric = Boolean(process.env.AI_API_KEY);
  return {
    apiKey: useGeneric ? process.env.AI_API_KEY : process.env.DEEPSEEK_API_KEY,
    baseURL: (useGeneric ? process.env.AI_BASE_URL : process.env.DEEPSEEK_BASE_URL) || "https://api.deepseek.com",
    model: (useGeneric ? process.env.AI_MODEL : process.env.DEEPSEEK_MODEL) || "deepseek-flash",
  };
}

// Extra request options that only some providers understand: switch "thinking" off
// (faster, cheaper, and temperature works).
function providerOptions(baseURL: string, model: string): Record<string, unknown> {
  if (baseURL.includes("deepseek")) return { thinking: { type: "disabled" } };
  if (baseURL.includes("googleapis")) return { reasoning_effort: model.includes("2.5") ? "none" : "minimal" };
  return {};
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

function getClient(): { openai: OpenAI; model: string; baseURL: string } {
  const { apiKey, baseURL, model } = settings();
  if (!apiKey) throw new AiError("not_configured", "AI_API_KEY is not set in .env.local");
  if (!client || clientKey !== apiKey + baseURL) {
    client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 1 });
    clientKey = apiKey + baseURL;
  }
  return { openai: client, model, baseURL };
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
  const { openai, model, baseURL } = getClient();

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
        ...providerOptions(baseURL, model),
      };
      const completion = await openai.chat.completions.create(
        params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );
      // Only ever use `content`. Some providers also return hidden reasoning
      // (e.g. `reasoning_content`); it must never be shown to users or parsed as the answer.
      content = completion.choices[0]?.message?.content;
    } catch (err) {
      const status = (err as { status?: number }).status;
      console.error(`AI request failed (attempt ${attempt}, status ${status ?? "none"}):`, (err as Error).message);
      // Retrying cannot fix these, so stop straight away with a clear reason.
      if (status === 402) throw new AiError("no_credit", "The AI account has no credit left (402)");
      if (status === 401 || status === 403) throw new AiError("bad_key", "The AI API key was refused");
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
