// Dev check: builds the built-in (no-AI) summary from a made-up week. No network, no database.
// Run: npx tsx scripts/test-fallback.mts
import { computeFacts } from "../lib/summary";
import { buildFallbackSummary } from "../lib/summary-fallback";
import { addDays, hongKongDate } from "../lib/doses";

const end = hongKongDate(new Date(Date.now() - 24 * 3600_000)); // up to yesterday
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
for (const lang of ["en", "zh"] as const) {
  console.log(`\n===== ${lang} =====`);
  console.log(JSON.stringify(buildFallbackSummary(facts, lang), null, 1));
}
