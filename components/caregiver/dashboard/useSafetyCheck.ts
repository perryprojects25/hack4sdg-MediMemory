"use client";

// Runs the medicine safety check for one patient and keeps the result.
// - The app's own checks (duplicates, many medicines, extra doses) run all the time.
// - The AI check runs by itself whenever the medicine list changes (once the caregiver
//   has agreed to AI use), so warnings appear before anyone asks. The result is kept on
//   this device, so the AI is only asked again when the medicines change.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/language";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DEMO_MODE } from "@/lib/demo-mode";
import { findDuplicates, type DuplicatePair } from "@/lib/duplicates";
import { ruleChecks, type RuleFinding, type SafetyResult } from "@/lib/safety";
import type { Patient } from "@/lib/types";
import { hasAiConsent } from "./AiConsent";
import type { PatientData } from "./usePatientData";

export type SafetyStatus = "noConsent" | "idle" | "checking" | "done" | "unavailable" | "failed";

export type SafetyCheck = {
  duplicates: DuplicatePair[];
  rules: RuleFinding[];
  ai: SafetyResult | null;
  status: SafetyStatus;
  count: number; // everything to ask the pharmacist about
  run: () => void;
  consent: () => void;
};

type Cached = { key: string; result: SafetyResult };

export function useSafetyCheck(patient: Patient, data: PatientData | null): SafetyCheck {
  const { lang } = useLanguage();
  const storageKey = `medimemory-safety-${patient.id}`;
  const [consented, setConsented] = useState<boolean | null>(null);
  const [cached, setCached] = useState<Cached | null>(null);
  const [status, setStatus] = useState<SafetyStatus>("idle");
  const tried = useRef(new Set<string>()); // never ask the AI twice for the same list in one visit

  const meds = useMemo(() => data?.medications ?? [], [data]);
  // Changes whenever an active medicine, its dose or its times change (or the language).
  const listKey = JSON.stringify([
    lang,
    meds.filter((m) => m.active).map((m) => [m.name, m.dose, m.schedules.map((s) => s.time_of_day).sort()]),
  ]);

  const duplicates = useMemo(() => findDuplicates(meds), [meds]);
  const rules = useMemo(() => (data ? ruleChecks(data.medications, data.logs, data.loadedAt) : []), [data]);

  // Read the consent and the last result kept on this device.
  useEffect(() => {
    async function read() {
      await Promise.resolve();
      setConsented(hasAiConsent());
      try {
        setCached(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
      } catch {
        setCached(null);
      }
    }
    read();
  }, [storageKey]);

  const run = useCallback(async () => {
    setStatus("checking");
    try {
      // Demo mode: no sign-in token; the server uses the demo caregiver.
      // Otherwise (disabled for hackathon demo): send the caregiver's sign-in token.
      const token = DEMO_MODE ? "" : ((await getSupabaseBrowser().auth.getSession()).data.session?.access_token ?? "");
      const response = await fetch("/api/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: patient.id, language: lang }),
      });
      if (response.status === 503) return setStatus("unavailable");
      if (!response.ok) return setStatus("failed");
      const result = (await response.json()) as SafetyResult;
      const next = { key: listKey, result };
      setCached(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      setStatus("done");
    } catch {
      setStatus("failed");
    }
  }, [patient.id, lang, listKey, storageKey]);

  // Proactive: check by itself when the medicine list is new or has changed.
  useEffect(() => {
    if (!data || !consented || cached?.key === listKey || tried.current.has(listKey)) return;
    tried.current.add(listKey);
    const timer = setTimeout(run, 0);
    return () => clearTimeout(timer);
  }, [data, consented, cached, listKey, run]);

  const ai = cached?.key === listKey ? cached.result : null;
  const shownStatus: SafetyStatus = consented === false ? "noConsent" : ai && status !== "checking" ? "done" : status;

  return {
    duplicates,
    rules,
    ai,
    status: shownStatus,
    count: duplicates.length + rules.length + (ai?.findings.length ?? 0),
    run,
    consent: () => setConsented(true),
  };
}
