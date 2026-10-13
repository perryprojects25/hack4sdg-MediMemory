"use client";

// The caregiver area: works out who is signed in, loads their data,
// and shows either the setup wizard or the caregiver home screen.

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "@/lib/language";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ensureCaregiver, loadMedications, loadPatient } from "@/lib/caregiver-data";
import type { Caregiver, Medication, Patient } from "@/lib/types";
import { ErrorBox, PrimaryButton } from "@/components/ui";
import Wizard from "./Wizard";
import CaregiverHome from "./CaregiverHome";

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Read once when the page opens: an expired magic link comes back with "error" in the address.
const cameBackWithLinkError =
  typeof window !== "undefined" && window.location.hash.includes("error");

type View =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "error" }
  | { kind: "ready"; caregiver: Caregiver; patient: Patient | null; medications: Medication[] };

export default function CaregiverApp() {
  const { t } = useLanguage();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);

  async function loadEverything(signedInUser: User) {
    try {
      const caregiver = await ensureCaregiver(signedInUser);
      const patient = await loadPatient(caregiver.id);
      const medications = patient ? await loadMedications(patient.id) : [];
      setView({ kind: "ready", caregiver, patient, medications });
    } catch (err) {
      console.error(err);
      setView({ kind: "error" });
    }
  }

  // Listen for sign in / sign out. This also picks up the magic link when the caregiver returns.
  useEffect(() => {
    if (!isConfigured) return;
    const { data } = getSupabaseBrowser().auth.onAuthStateChange((event, session) => {
      // Token refreshes happen every hour; no need to reload anything for them.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setView({ kind: "signedOut" });
        return;
      }
      // Supabase advises not to call it from inside this callback, so wait one tick.
      setTimeout(() => loadEverything(nextUser), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return (
      <Shell>
        <ErrorBox>{t("notConfigured")}</ErrorBox>
      </Shell>
    );
  }

  if (view.kind === "loading") {
    return (
      <Shell>
        <p className="text-center text-xl text-slate-800" role="status">
          {t("loading")}
        </p>
      </Shell>
    );
  }

  if (view.kind === "error") {
    return (
      <Shell>
        <ErrorBox>{t("genericError")}</ErrorBox>
        <PrimaryButton className="mt-4" onClick={() => location.reload()}>
          {t("tryAgain")}
        </PrimaryButton>
      </Shell>
    );
  }

  if (view.kind === "signedOut") {
    return (
      <Shell>
        <Wizard initialStep={1} data={null} linkExpired={cameBackWithLinkError} />
      </Shell>
    );
  }

  // Signed in. Helpers that let the wizard update what's on screen.
  const setPatient = (patient: Patient) =>
    setView((v) => (v.kind === "ready" ? { ...v, patient } : v));
  const setMedications = (medications: Medication[]) =>
    setView((v) => (v.kind === "ready" ? { ...v, medications } : v));

  const setupFinished = Boolean(view.patient?.pin);
  if (setupFinished && !editing) {
    return (
      <Shell>
        <CaregiverHome
          caregiver={view.caregiver}
          patient={view.patient!}
          medications={view.medications}
          onEdit={() => setEditing(true)}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Wizard
        // Start where the caregiver left off.
        initialStep={editing ? 2 : view.patient ? 3 : 2}
        data={{
          email: user?.email ?? view.caregiver.email,
          caregiver: view.caregiver,
          patient: view.patient,
          medications: view.medications,
          setPatient,
          setMedications,
          onFinished: (patient) => {
            setEditing(false);
            setPatient(patient);
          },
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>;
}
