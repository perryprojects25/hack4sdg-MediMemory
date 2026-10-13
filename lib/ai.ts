// The ONE place the app talks to an AI model. Every AI feature goes through
// generateJSON(), so the provider can be swapped later by changing this file only.
//
// Provider: DeepSeek, via its OpenAI-compatible API (the standard `openai` package
// pointed at DEEPSEEK_BASE_URL). Server-side only: the API key never reaches the browser.
// Notes from https://api-docs.deepseek.com (checked 2026-10-13):
//   - models: "deepseek-flash" (fast, default) and "deepseek-v4-pro"
//   - thinking mode is ON by default; we switch it OFF with thinking: { type: "disabled" }
//     to keep it fast and cheap, and temperature only works with thinking off
//   - JSON output: response_format { type: "json_object" }, the prompt must contain the
//     word "json" plus an example, and max_tokens must be large enough; the API can
//     occasionally return empty content, so we retry once.

import "server-only";
import OpenAI from "openai";

export class AiError extends Error {
  constructor(public code: "not_configured" | "bad_output" | "request_failed", message: string) {
    super(message);
  }
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AiError("not_configured", "DEEPSEEK_API_KEY is not set in .env.local");
  client ??= new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    timeout: 60_000, // ms
    maxRetries: 1, // network-level retry
  });
  return client;
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
  const openai = getClient();
  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";

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
        thinking: { type: "disabled" }, // DeepSeek-specific option, passed through in the request body
      };
      const completion = await openai.chat.completions.create(
        params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
      );
      // Only ever use `content`. If thinking were on, `reasoning_content` would also be
      // present; it must never be shown to users or parsed as the answer.
      content = completion.choices[0]?.message?.content;
    } catch (err) {
      console.error(`AI request failed (attempt ${attempt})`, err);
      if (attempt === 2) throw new AiError("request_failed", "The AI service did not respond");
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(content ?? "");
      if (isValid(parsed)) return parsed;
      console.error(`AI answer had missing keys (attempt ${attempt})`);
    } catch {
      console.error(`AI answer was not valid JSON (attempt ${attempt})`);
    }
  }
  throw new AiError("bad_output", "The AI answer could not be used");
}
