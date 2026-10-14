// Doctor summary (Step 7).
// 1. computeFacts(): works out the numbers IN CODE from the logs.
// 2. The facts + caregiver notes go to the AI with a strict prompt (SYSTEM_PROMPT).
// 3. The AI only writes them up as structured JSON. It never sees names or IDs.

import { adherenceByMedicine, adherencePct, isResolved, takenLate } from "./adherence";
import { buildDoses, addDays, hongKongDate, weekdayOf, type DoseInstance, type LogForDoses, type MedForDoses } from "./doses";
import { TIME_ZONE } from "./dose-rules";

// ---------------------------------------------------------------------------
// What the AI must return
// ---------------------------------------------------------------------------

export type AiSummary = {
  overview: string;
  adherence_by_medicine: string[];
  patterns_observed: string[];
  possible_discrepancies: string[];
  caregiver_observations: string[];
  suggested_topics_to_discuss: string[];
  data_limitations: string[];
};

const LIST_KEYS = [
  "adherence_by_medicine",
  "patterns_observed",
  "possible_discrepancies",
  "caregiver_observations",
  "suggested_topics_to_discuss",
  "data_limitations",
] as const;

export function isAiSummary(value: unknown): value is AiSummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.overview !== "string" || v.overview.trim() === "") return false;
  return LIST_KEYS.every((key) => Array.isArray(v[key]) && (v[key] as unknown[]).every((x) => typeof x === "string"));
}

// ---------------------------------------------------------------------------
// Facts computed in code
// ---------------------------------------------------------------------------

export type RawLogRow = {
  scheduledFor: string;
  medicine: string;
  status: string;
  loggedAt: string;
  loggedBy: string;
};

export type SummaryMedication = {
  name: string;
  dose: string;
  times: string[];
  shape: string | null;
  color: string | null;
  source: "hospital_record_simulated" | "entered_by_caregiver";
  active: boolean;
};

export type SummaryFacts = {
  period: { start: string; end: string; days: number };
  medications: (SummaryMedication & {
    adherence_pct: number | null;
    doses_due: number;
    taken: number;
    missed: number;
    taken_late: number;
    possible_double_doses: number;
  })[];
  overall: { adherence_pct: number | null; doses_due: number; taken: number; missed: number; taken_late: number };
  confirmed_by: { patient_button: number; patient_voice: number; caregiver: number };
  missed_by_time_of_day: { morning: number; afternoon: number; evening: number; night: number };
  missed_weekday_vs_weekend: {
    weekday_missed: number;
    weekday_doses: number;
    weekend_missed: number;
    weekend_doses: number;
  };
  evening_doses_weekday_vs_weekend: {
    weekday_missed: number;
    weekday_doses: number;
    weekend_missed: number;
    weekend_doses: number;
  };
  possible_double_doses: { medicine: string; date: string; scheduled_time: string; confirmations: string[] }[];
  gaps_over_24h_without_any_dose_taken: { from: string; to: string; hours: number }[];
  caregiver_notes: { date: string; note: string }[];
};

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function hkHour(iso: string): number {
  return Number(timeFmt.format(new Date(iso)).slice(0, 2));
}

function partOfDay(iso: string): "morning" | "afternoon" | "evening" | "night" {
  const h = hkHour(iso);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export function computeFacts({
  meds,
  logs,
  notes,
  start,
  end,
  now = new Date(),
}: {
  meds: MedForDoses[];
  logs: LogForDoses[];
  notes: { note: string; created_at: string }[];
  start: string;
  end: string;
  now?: Date;
}): { facts: SummaryFacts; medications: SummaryMedication[]; rawLog: RawLogRow[] } {
  const dates = datesBetween(start, end);
  const doses = buildDoses(meds, logs, dates, now);
  const resolved = doses.filter(isResolved);
  const missed = resolved.filter((d) => d.status === "missed");

  const medications: SummaryMedication[] = meds.map((m) => ({
    name: m.name,
    dose: m.dose,
    times: m.schedules.map((s) => s.time_of_day.slice(0, 5)).sort(),
    shape: m.shape,
    color: m.color,
    source: m.source === "HA_demo" ? "hospital_record_simulated" : "entered_by_caregiver",
    active: m.active,
  }));

  const perMed = adherenceByMedicine(doses);
  const isWeekend = (d: DoseInstance) => [0, 6].includes(weekdayOf(d.date));

  // Who confirmed the doses that were taken
  const takenDoses = resolved.filter((d) => d.status === "taken");
  const countBy = (who: string) => takenDoses.filter((d) => d.takenBy === who).length;

  // Gaps of more than 24 hours between doses actually taken
  const takenTimes = logs
    .filter((l) => l.status === "taken")
    .map((l) => new Date(l.logged_at).getTime())
    .sort((a, b) => a - b);
  const gaps: SummaryFacts["gaps_over_24h_without_any_dose_taken"] = [];
  for (let i = 1; i < takenTimes.length; i++) {
    const hours = (takenTimes[i] - takenTimes[i - 1]) / 3_600_000;
    if (hours > 24) {
      gaps.push({
        from: dateTimeFmt.format(new Date(takenTimes[i - 1])),
        to: dateTimeFmt.format(new Date(takenTimes[i])),
        hours: Math.round(hours),
      });
    }
  }

  const facts: SummaryFacts = {
    period: { start, end, days: dates.length },
    medications: medications.map((m, i) => {
      const stats = perMed.find((p) => p.medicationId === meds[i].id);
      return {
        ...m,
        adherence_pct: stats?.pct ?? null,
        doses_due: stats?.scheduled ?? 0,
        taken: stats?.taken ?? 0,
        missed: stats?.missed ?? 0,
        taken_late: stats?.takenLate ?? 0,
        possible_double_doses: stats?.doubleDoses ?? 0,
      };
    }),
    overall: {
      adherence_pct: adherencePct(doses),
      doses_due: resolved.length,
      taken: takenDoses.length,
      missed: missed.length,
      taken_late: resolved.filter(takenLate).length,
    },
    confirmed_by: {
      patient_button: countBy("patient"),
      patient_voice: countBy("voice"),
      caregiver: countBy("caregiver"),
    },
    missed_by_time_of_day: {
      morning: missed.filter((d) => partOfDay(d.scheduledFor) === "morning").length,
      afternoon: missed.filter((d) => partOfDay(d.scheduledFor) === "afternoon").length,
      evening: missed.filter((d) => partOfDay(d.scheduledFor) === "evening").length,
      night: missed.filter((d) => partOfDay(d.scheduledFor) === "night").length,
    },
    missed_weekday_vs_weekend: {
      weekday_missed: missed.filter((d) => !isWeekend(d)).length,
      weekday_doses: resolved.filter((d) => !isWeekend(d)).length,
      weekend_missed: missed.filter(isWeekend).length,
      weekend_doses: resolved.filter(isWeekend).length,
    },
    evening_doses_weekday_vs_weekend: (() => {
      const evening = resolved.filter((d) => partOfDay(d.scheduledFor) === "evening");
      return {
        weekday_missed: evening.filter((d) => !isWeekend(d) && d.status === "missed").length,
        weekday_doses: evening.filter((d) => !isWeekend(d)).length,
        weekend_missed: evening.filter((d) => isWeekend(d) && d.status === "missed").length,
        weekend_doses: evening.filter(isWeekend).length,
      };
    })(),
    possible_double_doses: doses
      .filter((d) => d.takenCount > 1)
      .map((d) => ({
        medicine: d.med.name,
        date: d.date,
        scheduled_time: timeFmt.format(new Date(d.scheduledFor)),
        confirmations: logs
          .filter(
            (l) =>
              l.status === "taken" &&
              l.medication_id === d.med.id &&
              new Date(l.scheduled_for).getTime() === new Date(d.scheduledFor).getTime()
          )
          .map((l) => `${timeFmt.format(new Date(l.logged_at))} by ${l.logged_by}`),
      })),
    gaps_over_24h_without_any_dose_taken: gaps,
    caregiver_notes: notes
      .filter((n) => {
        const day = hongKongDate(new Date(n.created_at));
        return day >= start && day <= end;
      })
      .map((n) => ({ date: hongKongDate(new Date(n.created_at)), note: n.note })),
  };

  // Raw log for the doctor to check the AI against (not sent to the AI).
  const medName = new Map(meds.map((m) => [m.id, m.name]));
  const rawLog: RawLogRow[] = logs
    .map((l) => ({
      scheduledFor: l.scheduled_for,
      medicine: medName.get(l.medication_id) ?? "?",
      status: l.status,
      loggedAt: l.logged_at,
      loggedBy: l.logged_by,
    }))
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.loggedAt.localeCompare(b.loggedAt));

  return { facts, medications, rawLog };
}

// ---------------------------------------------------------------------------
// The prompt
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are a clinical documentation assistant. You SUMMARISE medication intake data that was logged by an older patient and their family caregiver, for the patient's doctor to read before a follow-up appointment.

Strict rules:
- Use ONLY the data provided in the user message. Never invent doses, times, dates, medicines, symptoms or events. If something is not in the data, do not mention it as fact.
- Do NOT diagnose. Do NOT recommend starting, stopping or changing any medicine or dose. Do NOT give medical advice of any kind.
- Flag uncertainty clearly. The data is self-reported, e.g. "Based on logs entered by the patient and caregiver, not independently verified." A dose recorded as taken only means someone pressed a button.
- Medicines marked "hospital_record_simulated" came from a SIMULATED demo hospital record, not a real one; say so in data_limitations if relevant.
- Refer to the person only as "the patient". Never use names.
- Tone: concise, neutral, professional, plain English suitable for a busy doctor. Use the numbers given; do not recalculate them differently.
- suggested_topics_to_discuss must be neutral, open questions the doctor MAY wish to ask (e.g. "Could the patient describe their evening routine at weekends?"), never instructions or recommendations.

Return ONLY a json object with exactly these keys:
{
  "overview": "3 to 4 sentences summarising the period.",
  "adherence_by_medicine": ["One short line per medicine with its adherence percentage and counts."],
  "patterns_observed": ["Short factual patterns, e.g. which time of day or days of the week doses are missed most."],
  "possible_discrepancies": ["Things the doctor may want to verify, e.g. possible double doses or doses confirmed by the caregiver rather than the patient."],
  "caregiver_observations": ["The caregiver's notes, briefly and faithfully restated with their dates."],
  "suggested_topics_to_discuss": ["Neutral questions the doctor may wish to ask."],
  "data_limitations": ["What this data cannot show."]
}
Every list may be empty ([]) if there is nothing to say. All values are plain strings.`;

export function userPrompt(facts: SummaryFacts, language: "en" | "zh"): string {
  const languageLine =
    language === "zh"
      ? "Write all text values in Traditional Chinese (Hong Kong). Keep medicine names as given."
      : "Write all text values in English.";
  return `${languageLine}

Here is the logged data for the period, already computed from the logs, as json:
${JSON.stringify(facts, null, 2)}`;
}

// What /api/summary returns, and what is stored in summaries.content_json.
export type SummaryContent = {
  patient: { name: string; age: number | null };
  period: { start: string; end: string };
  language: "en" | "zh";
  summary: AiSummary;
  writtenBy?: "ai" | "automatic"; // "automatic" = built-in fallback, AI was unavailable
  facts: SummaryFacts;
  medications: SummaryMedication[];
  rawLog: RawLogRow[];
  generatedAt: string;
};
