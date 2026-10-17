// Server side of the AI medicine safety check. Used by /api/safety (dashboard)
// and /api/summary (doctor summary). Only medicine details and an age band are
// sent to the AI, never the patient's name.

import "server-only";
import { AiError, generateJSON } from "./ai";
import {
  SAFETY_SYSTEM_PROMPT,
  cleanFindings,
  isAiSafety,
  safetyUserPrompt,
  type AiFinding,
  type SafetyMedicine,
} from "./safety";

type MedRow = {
  name: string;
  dose: string;
  form?: string | null;
  instructions: string | null;
  active: boolean;
  schedules?: { time_of_day: string }[] | null;
};

// Returns the AI's findings for the ACTIVE medicines, or null if the AI is unavailable.
export async function aiSafetyCheck(age: number | null, meds: MedRow[], language: "en" | "zh"): Promise<AiFinding[] | null> {
  const medicines: SafetyMedicine[] = meds
    .filter((m) => m.active)
    .map((m) => ({
      name: m.name,
      dose: m.dose,
      form: m.form ?? null,
      times: (m.schedules ?? []).map((s) => s.time_of_day.slice(0, 5)).sort(),
      instructions: m.instructions,
    }));
  if (medicines.length < 2) return []; // nothing to compare

  try {
    const answer = await generateJSON({
      system: SAFETY_SYSTEM_PROMPT,
      user: safetyUserPrompt(age, medicines, language),
      isValid: isAiSafety,
      maxTokens: 3000,
    });
    return cleanFindings(answer.findings, medicines.map((m) => m.name));
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("safety check: AI unavailable", err.code);
    return null;
  }
}
