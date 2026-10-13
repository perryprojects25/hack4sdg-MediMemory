// Dev check of lib/ai.ts against a FAKE local AI server (no real API call).
// Run: npx tsx --conditions=react-server scripts/test-ai.mts
import http from "node:http";

const requests: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
let call = 0;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    requests.push(JSON.parse(body));
    call++;
    // First answer is broken JSON (to test the retry), second is valid.
    const content = call === 1 ? "{not json" : JSON.stringify({
      overview: "Test overview.", adherence_by_medicine: ["a"], patterns_observed: [], possible_discrepancies: [],
      caregiver_observations: [], suggested_topics_to_discuss: [], data_limitations: ["b"],
    });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "m",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content, reasoning_content: "SECRET THINKING" } }] }));
  });
});
await new Promise<void>((r) => server.listen(4010, r));

process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DEEPSEEK_BASE_URL = "http://localhost:4010";
process.env.DEEPSEEK_MODEL = "deepseek-flash";
const { generateJSON } = await import("../lib/ai");
const { SYSTEM_PROMPT, isAiSummary, userPrompt } = await import("../lib/summary");

const fakeFacts = { period: { start: "2026-10-01", end: "2026-10-13", days: 13 } } as unknown as Parameters<typeof userPrompt>[0];
const result = await generateJSON({ system: SYSTEM_PROMPT, user: userPrompt(fakeFacts, "en"), isValid: isAiSummary });
const sent = requests[0];
console.log("calls made:", requests.length, "(1 broken + 1 retry expected = 2)");
console.log("model:", sent.model, "| thinking:", JSON.stringify(sent.thinking), "| response_format:", JSON.stringify(sent.response_format));
console.log("temperature:", sent.temperature, "| max_tokens:", sent.max_tokens);
console.log("prompt mentions json:", /json/i.test(sent.messages[0].content + sent.messages[1].content));
console.log("result overview:", result.overview, "| reasoning leaked:", JSON.stringify(result).includes("SECRET"));
server.close();
