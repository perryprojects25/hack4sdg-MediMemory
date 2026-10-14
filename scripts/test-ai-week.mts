// Dev check: a REAL AI summary of a made-up week (same data as test-fallback.mts).
// Run: npx tsx --conditions=react-server --env-file=.env.local scripts/test-ai-week.mts [en|zh]
import { computeFacts, SYSTEM_PROMPT, isAiSummary, userPrompt } from "../lib/summary";
import { generateJSON } from "../lib/ai";
import { addDays, hongKongDate } from "../lib/doses";

const lang = process.argv[2] === "zh" ? "zh" : "en";
const end = hongKongDate(new Date(Date.now() - 24 * 3600_000));
const start = addDays(end, -6);
const created = new Date(`${start}T00:00:00+08:00`).toISOString();
const meds = [
  { id: "m1", name: "Metformin", dose: "500 mg", shape: "round", color: "white", instructions: null, source: "HA_demo", active: true, created_at: created,
    schedules: [{ time_of_day: "08:00:00", days_of_week: [0,1,2,3,4,5,6] }, { time_of_day: "18:00:00", days_of_week: [0,1,2,3,4,5,6] }] },
  { id: "m2", name: "Amlodipine", dose: "5 mg", shape: "oval", color: "pink", instructions: null, source: "manual", active: true, created_at: created,
    schedules: [{ time_of_day: "08:00:00", days_of_week: [0,1,2,3,4,5,6] }] },
];
const logs: { medication_id: string; scheduled_for: string; status: string; logged_at: string; logged_by: string }[] = [];
for (let d = start, i = 0; d <= end; d = addDays(d, 1), i++) {
  for (const [med, time] of [["m1", "08:00"], ["m1", "18:00"], ["m2", "08:00"]] as const) {
    const due = new Date(`${d}T${time}:00+08:00`);
    const at = (min: number) => new Date(due.getTime() + min * 60000).toISOString();
    if (time === "18:00" && i % 3 === 0) { logs.push({ medication_id: med, scheduled_for: due.toISOString(), status: "missed", logged_at: at(90), logged_by: "auto" }); continue; }
    logs.push({ medication_id: med, scheduled_for: due.toISOString(), status: "taken", logged_at: at(i === 2 ? 45 : 5), logged_by: i === 4 ? "caregiver" : "patient" });
    if (i === 1 && med === "m2") logs.push({ medication_id: med, scheduled_for: due.toISOString(), status: "taken", logged_at: at(150), logged_by: "caregiver" });
  }
}
const notes = [{ note: "Felt dizzy in the morning.", created_at: new Date(`${addDays(start, 2)}T21:00:00+08:00`).toISOString() }];
const { facts } = computeFacts({ meds, logs, notes, start, end });
const t0 = Date.now();
const summary = await generateJSON({ system: SYSTEM_PROMPT, user: userPrompt(facts, lang), isValid: isAiSummary });
console.log(`took ${Date.now() - t0} ms`);
console.log(JSON.stringify(summary, null, 1));
const text = JSON.stringify(summary).toLowerCase();
console.log("\nRULE CHECKS");
console.log("names the facts' overall %:", text.includes(String(facts.overall.adherence_pct)));
console.log("mentions double dose:", /double|more than once|twice|重複|多於一次|兩次/.test(text));
console.log("states limitations:", summary.data_limitations.length > 0);
console.log("advice words found:", (text.match(/\b(should take|increase|decrease|reduce the dose|stop taking|start taking|recommend|diagnos)/g) ?? []).join(", ") || "none");
console.log("uses names:", /mrs\.|chan|anas/.test(text));
