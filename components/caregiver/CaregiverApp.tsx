"use client";

// The caregiver area: works out who is signed in, loads their data,
// and shows either the setup wizard or the caregiver home screen.

import { useEffect, useRef, useState } from "react";
import { CirclePlay } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "@/lib/language";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ensureCaregiver, loadMedications, loadPatient, loadPatients, selectPatient } from "@/lib/caregiver-data";
import type { Caregiver, Medication, Patient } from "@/lib/types";
import { loadDemo } from "@/lib/demo-data";
import { ErrorBox, PrimaryButton } from "@/components/ui";
import Wizard from "./Wizard";
import Dashboard from "./dashboard/Dashboard";

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
  | {
      kind: "ready";
      caregiver: Caregiver;
      patients: Patient[];
      patient: Patient | null;
      medications: Medication[];
    };

export default function CaregiverApp({
  startDemo = false,
  accountDeleted = false,
}: {
  startDemo?: boolean;
  accountDeleted?: boolean;
}) {
  const { t } = useLanguage();
  // "Try the demo": load Mrs. Chan once, as soon as the caregiver is signed in.
  const demoPending = useRef(startDemo);
  const [demoFailed, setDemoFailed] = useState(false);
  const [demoNote, setDemoNote] = useState(startDemo); // "preparing" / "sign in first" notes
  const [view, setView] = useState<View>({ kind: "loading" });
  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  // Adding another person: remember who was shown before, so Cancel can go back to them.
  const [adding, setAdding] = useState<{ previousId: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadEverything(signedInUser: User) {
    try {
      // If the account was deleted (e.g. from another device), the saved sign-in
      // is no longer valid: sign out quietly and show the sign-in page.
      const { error: userError } = await getSupabaseBrowser().auth.getUser();
      if (userError) {
        await getSupabaseBrowser().auth.signOut({ scope: "local" });
        setView({ kind: "signedOut" });
        return;
      }
      const caregiver = await ensureCaregiver(signedInUser);
      if (demoPending.current) {
        demoPending.current = false;
        try {
          await loadDemo(caregiver.id); // also selects Mrs. Chan
        } catch (err) {
          console.error(err);
          setDemoFailed(true);
        }
        window.history.replaceState(null, "", "/caregiver"); // don't reload the demo on refresh
        setDemoNote(false);
      }
      const [patients, patient] = await Promise.all([loadPatients(caregiver.id), loadPatient(caregiver.id)]);
      const medications = patient ? await loadMedications(patient.id) : [];
      setView({ kind: "ready", caregiver, patients, patient, medications });
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
          {demoNote ? t("lpDemoPreparing") : t("loading")}
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
        {accountDeleted && (
          <p role="status" className="mb-6 rounded-2xl border-2 border-green-700 bg-green-50 p-4 text-lg font-semibold text-green-900">
            {t("accDeleted")}
          </p>
        )}
        {demoNote && (
          <p className="mb-6 rounded-2xl border-2 border-teal-700 bg-teal-50 p-4 text-lg text-slate-900">
            {t("lpDemoSignIn")}
          </p>
        )}
        {!demoNote && <DemoPrompt />}
        <Wizard initialStep={1} data={null} linkExpired={cameBackWithLinkError} />
      </Shell>
    );
  }

  // Signed in. Helpers that let the wizard update what's on screen.
  const setPatient = (patient: Patient) => {
    if (adding) selectPatient(patient.id); // the new person becomes the one shown
    setView((v) => (v.kind === "ready" ? { ...v, patient } : v));
  };
  const reloadAll = () => (user ? loadEverything(user) : Promise.resolve());

  function startAdding() {
    if (view.kind !== "ready") return;
    setNotice(null);
    setAdding({ previousId: view.patient?.id ?? null });
    setView({ ...view, patient: null, medications: [] });
  }

  async function cancelAdding() {
    if (adding?.previousId) selectPatient(adding.previousId);
    setAdding(null);
    await reloadAll();
  }
  const setMedications = (medications: Medication[]) =>
    setView((v) => (v.kind === "ready" ? { ...v, medications } : v));

  const setupFinished = Boolean(view.patient?.pin);
  if (setupFinished && !editing && !adding) {
    return (
      <Shell>
        {demoFailed && (
          <div className="mb-6">
            <ErrorBox>{t("lpDemoFailed")}</ErrorBox>
          </div>
        )}
        {notice && (
          <p role="status" className="mb-6 rounded-2xl border-2 border-green-700 bg-green-50 p-4 text-lg font-semibold text-green-900">
            {notice}
          </p>
        )}
        <Dashboard
          key={view.patient!.id} // start fresh when switching patient
          caregiver={view.caregiver}
          patients={view.patients}
          patient={view.patient!}
          onEdit={() => setEditing(true)}
          onPatientChanged={setPatient}
          onEverythingChanged={reloadAll}
          onAddPerson={startAdding}
          onDeleted={async (name) => {
            setNotice(t("delDone", { name }));
            await reloadAll();
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Offer the demo while nobody is set up yet (not while adding or editing a person) */}
      {!adding && !editing && view.patients.length === 0 && <DemoPrompt />}
      <Wizard
        // Start where the caregiver left off.
        initialStep={editing || adding ? 2 : view.patient ? 3 : 2}
        onCancel={adding ? cancelAdding : undefined}
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
            if (adding) {
              setAdding(null);
              reloadAll(); // refresh the list of people
            }
          },
        }}
      />
    </Shell>
  );
}

// "Want to look around first? Try the demo →"
// A full page load on purpose, so /caregiver?demo=1 starts the demo (after sign-in if needed).
function DemoPrompt() {
  const { t } = useLanguage();
  return (
    <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white px-4 py-3 text-lg text-slate-800 ring-1 ring-slate-200">
      <CirclePlay aria-hidden="true" className="h-6 w-6 shrink-0 text-teal-700" />
      {t("cgDemoPrompt")}
      <a
        href="/caregiver?demo=1"
        className="rounded font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        {t("lpDemoLink")}
      </a>
    </p>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>;
}
