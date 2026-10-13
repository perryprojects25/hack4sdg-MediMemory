// Dev check: one real call to the AI provider with a tiny made-up fact sheet.
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/test-ai-live.mts
const { generateJSON } = await import("../lib/ai");
const { SYSTEM_PROMPT, isAiSummary, userPrompt } = await import("../lib/summary");
const facts = {
  period: { start: "2026-10-01", end: "2026-10-07", days: 7 },
  medications: [{ name: "Test tablet", dose: "1 tablet", times: ["08:00"], adherence_pct: 86, doses_due: 7, taken: 6, missed: 1 }],
  overall: { adherence_pct: 86, doses_due: 7, taken: 6, missed: 1, taken_late: 0 },
} as unknown as Parameters<typeof userPrompt>[0];
const t0 = Date.now();
try {
  const result = await generateJSON({ system: SYSTEM_PROMPT, user: userPrompt(facts, "en"), isValid: isAiSummary });
  console.log("OK in", Date.now() - t0, "ms:", result.overview.slice(0, 120));
} catch (err) {
  console.log("FAILED:", (err as Error).message);
}
