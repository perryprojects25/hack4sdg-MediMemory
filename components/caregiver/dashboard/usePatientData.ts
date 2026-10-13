"use client";

// Loads everything the dashboard shows for one patient, and refreshes it
// every 20 seconds so it updates soon after the patient confirms a dose.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  loadLogs,
  loadMedications,
  loadNotes,
  type CaregiverNote,
  type IntakeLog,
} from "@/lib/caregiver-data";
import { buildDoses, dayStartISO, lastDays, sweepPatient, type DoseInstance } from "@/lib/doses";
import type { Medication, Patient } from "@/lib/types";

// How much history the dashboard looks at.
export const HISTORY_DAYS = 28;
const REFRESH_SECONDS = 20;

export type PatientData = {
  medications: Medication[];
  logs: IntakeLog[];
  notes: CaregiverNote[];
  doses: DoseInstance[]; // every scheduled dose in the last HISTORY_DAYS days
  dates: string[];
  loadedAt: Date;
};

export function usePatientData(patient: Patient) {
  const [data, setData] = useState<Omit<PatientData, "doses" | "dates"> | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      // First record any unanswered doses as late / missed (Step 5 rules).
      await sweepPatient(getSupabaseBrowser(), patient.id).catch((err) => console.error(err));
      const since = dayStartISO(lastDays(HISTORY_DAYS)[0]);
      const [medications, logs, notes] = await Promise.all([
        loadMedications(patient.id),
        loadLogs(patient.id, since),
        loadNotes(patient.id),
      ]);
      setData({ medications, logs, notes, loadedAt: new Date() });
      setFailed(false);
    } catch (err) {
      console.error(err);
      setFailed(true);
    }
  }, [patient.id]);

  useEffect(() => {
    // Load straight away (after this render), then every REFRESH_SECONDS.
    const first = setTimeout(reload, 0);
    const timer = setInterval(reload, REFRESH_SECONDS * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [reload]);

  const full = useMemo<PatientData | null>(() => {
    if (!data) return null;
    const dates = lastDays(HISTORY_DAYS, data.loadedAt);
    return { ...data, dates, doses: buildDoses(data.medications, data.logs, dates, data.loadedAt) };
  }, [data]);

  return { data: full, failed, reload };
}
