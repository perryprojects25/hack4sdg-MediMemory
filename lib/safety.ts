// Medicine safety check (polypharmacy and possible drug interactions).
//
// Two parts:
// 1. Rule-based checks done IN CODE (always on, no AI): many medicines at once,
//    the same dose confirmed more than once, and two doses close together.
//    The duplicate-ingredient check is in lib/duplicates.ts.
// 2. An AI check (POST /api/safety) that looks at the whole active medicine list for
//    possible interactions, double-ups, doses to ask about, and medicines that need
//    extra care at an older age.
//
// Neither part diagnoses or gives advice. Every result is phrased as something to
// ask the pharmacist or doctor about, and the caregiver is told not to stop or change
// any medicine because of it.

import type { IntakeLog } from "./caregiver-data";
import type { Medication } from "./types";
import { hongKongDate } from "./doses";

// ---------------------------------------------------------------------------
// 1. Rule-based checks
// ---------------------------------------------------------------------------

// From this many daily medicines on, suggest a medicine review ("polypharmacy").
export const MANY_MEDICINES = 5;
// How far back to look for extra doses.
export const SAFETY_LOOKBACK_DAYS = 14;
const CLOSE_DOSE_HOURS = 2;
const HOUR = 60 * 60 * 1000;

export type RuleFinding =
  | { kind: "manyMedicines"; count: number }
  | { kind: "extraDose"; medicine: string; scheduledFor: string; count: number }
  | { kind: "closeDoses"; medicine: string; firstAt: string; secondAt: string };

export function ruleChecks(meds: Medication[], logs: IntakeLog[], now = new Date()): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const active = meds.filter((m) => m.active);
  if (active.length >= MANY_MEDICINES) findings.push({ kind: "manyMedicines", count: active.length });

  const since = now.getTime() - SAFETY_LOOKBACK_DAYS * 24 * HOUR;
  const nameOf = new Map(meds.map((m) => [m.id, m.name]));
  const taken = logs
    .filter((l) => l.status === "taken" && new Date(l.logged_at).getTime() >= since)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));

  // The same dose confirmed more than once.
  const perDose = new Map<string, IntakeLog[]>();
  for (const log of taken) {
    const key = `${log.medication_id}|${new Date(log.scheduled_for).toISOString()}`;
    perDose.set(key, [...(perDose.get(key) ?? []), log]);
  }
  for (const group of perDose.values()) {
    if (group.length > 1) {
      findings.push({
        kind: "extraDose",
        medicine: nameOf.get(group[0].medication_id) ?? "?",
        scheduledFor: group[0].scheduled_for,
        count: group.length,
      });
    }
  }

  // Two different doses of the same medicine confirmed less than 2 hours apart.
  const perMedicine = new Map<string, IntakeLog[]>();
  for (const log of taken) perMedicine.set(log.medication_id, [...(perMedicine.get(log.medication_id) ?? []), log]);
  for (const [medId, list] of perMedicine) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      const sameDose = new Date(a.scheduled_for).getTime() === new Date(b.scheduled_for).getTime();
      const gap = new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime();
      if (!sameDose && gap < CLOSE_DOSE_HOURS * HOUR) {
        findings.push({ kind: "closeDoses", medicine: nameOf.get(medId) ?? "?", firstAt: a.logged_at, secondAt: b.logged_at });
      }
    }
  }
  return findings;
}

// The date (Hong Kong) of a finding, for display.
export const findingDate = (iso: string) => hongKongDate(new Date(iso));

// ---------------------------------------------------------------------------
// 2. AI check: what the AI must return
// ---------------------------------------------------------------------------

export const FINDING_TYPES = ["interaction", "duplicate", "dose", "older_adults"] as const;
export const FINDING_LEVELS = ["ask_soon", "next_visit"] as const;

export type AiFinding = {
  medicines: string[]; // exact names from the list
  type: (typeof FINDING_TYPES)[number];
  level: (typeof FINDING_LEVELS)[number];
  what: string; // plain explanation
  ask: string; // a question for the pharmacist or doctor
};

export type SafetyResult = { findings: AiFinding[]; checkedAt: string };

export function isAiSafety(value: unknown): value is { findings: AiFinding[] } {
  if (typeof value !== "object" || value === null) return false;
  const findings = (value as { findings?: unknown }).findings;
  return (
    Array.isArray(findings) &&
    findings.every((f) => {
      if (typeof f !== "object" || f === null) return false;
      const x = f as Record<string, unknown>;
      return (
        Array.isArray(x.medicines) &&
        x.medicines.length > 0 &&
        x.medicines.every((m) => typeof m === "string") &&
        FINDING_TYPES.includes(x.type as AiFinding["type"]) &&
        FINDING_LEVELS.includes(x.level as AiFinding["level"]) &&
        typeof x.what === "string" &&
        x.what.trim() !== "" &&
        typeof x.ask === "string"
      );
    })
  );
}

export const SAFETY_SYSTEM_PROMPT = `You are a medication safety screening helper. A family caregiver of an older person in Hong Kong wants to know which of the person's medicines they should ask a pharmacist or doctor about.

You receive the person's age group and their full list of current medicines (name, dose, form, daily times, instructions). Look at the medicines TOGETHER and report:
- "interaction": two or more medicines on the list that are well known to interact (for example a raised bleeding risk, blood pressure dropping too low, blood sugar going too low).
- "duplicate": the same active ingredient, or two medicines from the same group, taken at the same time.
- "dose": a dose or number of daily doses that is clearly above the usual maximum on the product label.
- "older_adults": a medicine that standard guidance for older adults (such as the Beers Criteria) says needs extra care in this age group.

Strict rules:
- Use ONLY the medicines on the list. Never invent medicines, conditions, test results or symptoms.
- Only report concerns that are well established in standard drug references. If you are not sure, leave it out. It is fine to return no findings.
- NEVER tell anyone to stop, start, skip, swap or change a medicine or a dose. NEVER diagnose. Every finding ends with a neutral question to ask the pharmacist or doctor.
- "level": "ask_soon" only for a serious, well-known risk (for example two blood thinners, or the same ingredient twice); otherwise "next_visit".
- "medicines": copy each name EXACTLY as written in the list.
- Write "what" in 1 or 2 short, calm sentences in plain words a family member understands. Explain any medical word. Do not be alarming.
- At most 6 findings, the most important first. Do not repeat the same concern twice.
- Write "what" and "ask" in the language requested.

Reply with JSON only, in exactly this structure:
{
  "findings": [
    {
      "medicines": ["<exact name>", "<exact name>"],
      "type": "interaction" | "duplicate" | "dose" | "older_adults",
      "level": "ask_soon" | "next_visit",
      "what": "<plain explanation>",
      "ask": "<question to ask the pharmacist or doctor>"
    }
  ]
}`;

// Age as a band only (minimum data).
export function ageGroup(age: number | null): string {
  if (age === null) return "unknown";
  if (age < 65) return "under 65";
  if (age < 75) return "65 to 74";
  if (age < 85) return "75 to 84";
  return "85 or older";
}

export type SafetyMedicine = { name: string; dose: string; form: string | null; times: string[]; instructions: string | null };

export function safetyUserPrompt(age: number | null, medicines: SafetyMedicine[], language: "en" | "zh"): string {
  return JSON.stringify({
    language:
      language === "zh"
        ? "Traditional Chinese as written in Hong Kong (standard written Chinese 書面語, not spoken Cantonese)"
        : "English",
    age_group: ageGroup(age),
    medicines,
  });
}

// Keep only findings that name medicines really on the list, using the list's own spelling.
export function cleanFindings(findings: AiFinding[], names: string[]): AiFinding[] {
  const match = (given: string) => {
    const g = given.trim().toLowerCase();
    return names.find((n) => n.toLowerCase() === g) ?? names.find((n) => n.toLowerCase().includes(g) || g.includes(n.toLowerCase()));
  };
  return findings
    .map((f) => {
      const medicines = f.medicines.map(match);
      return medicines.every(Boolean) ? { ...f, medicines: [...new Set(medicines as string[])] } : null;
    })
    .filter((f): f is AiFinding => f !== null)
    .slice(0, 6);
}
