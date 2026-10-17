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
import { DEMO_MODE } from "@/lib/demo-mode";
import { ErrorBox, PrimaryButton, SecondaryButton } from "@/components/ui";
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
  const [guestDemoOff, setGuestDemoOff] = useState(false); // anonymous sign-in is switched off in Supabase
  const [leaving, setLeaving] = useState(false);

  // signedInUser is null in demo mode: everyone is the fixed demo caregiver.
  async function loadEverything(signedInUser: User | null) {
    try {
      let caregiver: Caregiver;
      if (DEMO_MODE || !signedInUser) {
        // Demo mode (null is only ever passed in demo mode).
        caregiver = await loadDemoCaregiver();
      } else {
        // Disabled for hackathon demo (runs only when DEMO_MODE is off).
        // If the account was deleted (e.g. from another device), the saved sign-in
        // is no longer valid: sign out quietly and show the sign-in page.
        const { error: userError } = await getSupabaseBrowser().auth.getUser();
        if (userError) {
          await getSupabaseBrowser().auth.signOut({ scope: "local" });
          setView({ kind: "signedOut" });
          return;
        }
        caregiver = await ensureCaregiver(signedInUser);
      }
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
    if (DEMO_MODE) {
      // Demo mode: nobody signs in; go straight to the demo caregiver's data.
      setTimeout(() => loadEverything(null), 0);
      return;
    }
    // Disabled for hackathon demo (runs only when DEMO_MODE is off).
    const { data } = getSupabaseBrowser().auth.onAuthStateChange((event, session) => {
      // Token refreshes happen every hour; no need to reload anything for them.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setView({ kind: "signedOut" });
        if (demoPending.current) setTimeout(() => startGuestDemo(), 0);
        return;
      }
      // Supabase advises not to call it from inside this callback, so wait one tick.
      setTimeout(() => loadEverything(nextUser), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Disabled for hackathon demo: never reached when DEMO_MODE is on.
  // "Try the demo" while signed out: sign in as a temporary guest (no email) and load Mrs. Chan.
  async function startGuestDemo() {
    demoPending.current = true;
    setDemoNote(true);
    setGuestDemoOff(false);
    setView({ kind: "loading" });
    const { error } = await getSupabaseBrowser().auth.signInAnonymously();
    if (error) {
      // Usually: "Allow anonymous sign-ins" is off in Supabase (Authentication > Sign In / Providers).
      console.error("Guest demo could not start:", error.message);
      demoPending.current = false;
      setDemoNote(false);
      setGuestDemoOff(true);
      setView({ kind: "signedOut" });
    }
    // On success, the sign-in listener above loads the demo.
  }

  // "Try the demo": guests get a temporary account; a signed-in caregiver (nobody set up yet) gets Mrs. Chan in theirs.
  function beginDemo() {
    if (DEMO_MODE) {
      demoPending.current = true;
      setDemoNote(true);
      setView({ kind: "loading" });
      loadEverything(null);
      return;
    }
    if (!user) return startGuestDemo(); // Disabled for hackathon demo
    demoPending.current = true;
    setDemoNote(true);
    setView({ kind: "loading" });
    loadEverything(user);
  }

  // Disabled for hackathon demo: the button only shows for guest accounts, which demo mode never creates.
  // "Leave the demo": delete the temporary guest account (and the demo data with it).
  async function leaveDemo() {
    setLeaving(true);
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: "{}",
    }).catch(() => {});
    await supabase.auth.signOut({ scope: "local" });
    try {
      localStorage.removeItem("medimemory-selected-patient");
    } catch {}
    window.location.replace("/");
  }

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
        {guestDemoOff ? (
          <p role="status" className="mb-6 rounded-2xl border-2 border-teal-700 bg-teal-50 p-4 text-lg text-slate-900">
            {t("demoGuestOff")}
          </p>
        ) : (
          !demoNote && <DemoPrompt onStart={beginDemo} />
        )}
        <Wizard initialStep={1} data={null} linkExpired={cameBackWithLinkError} />
      </Shell>
    );
  }

  // Signed in. Helpers that let the wizard update what's on screen.
  const setPatient = (patient: Patient) => {
    if (adding) selectPatient(patient.id); // the new person becomes the one shown
    setView((v) => (v.kind === "ready" ? { ...v, patient } : v));
  };
  const reloadAll = () => (user || DEMO_MODE ? loadEverything(user) : Promise.resolve());

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
        {user?.is_anonymous && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border-2 border-violet-700 bg-violet-50 p-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-lg text-slate-900">{t("demoBanner")}</p>
            <SecondaryButton onClick={leaveDemo} disabled={leaving} className="min-h-12 text-lg">
              {leaving ? t("saving") : t("demoLeave")}
            </SecondaryButton>
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
      {!adding && !editing && view.patients.length === 0 && <DemoPrompt onStart={beginDemo} />}
      <Wizard
        // Start where the caregiver left off.
        // Demo mode: a new visitor first sees the (simulated) sign-in screen.
        initialStep={editing || adding ? 2 : view.patient ? 3 : DEMO_MODE ? 1 : 2}
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

// "Want to look around first? Try the demo →" (opens the demo straight away, no email needed)
function DemoPrompt({ onStart }: { onStart: () => void }) {
  const { t } = useLanguage();
  return (
    <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white px-4 py-3 text-lg text-slate-800 ring-1 ring-slate-200">
      <CirclePlay aria-hidden="true" className="h-6 w-6 shrink-0 text-teal-700" />
      {t("cgDemoPrompt")}
      <button
        type="button"
        onClick={onStart}
        className="rounded font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        {t("lpDemoLink")}
      </button>
    </p>
  );
}

// Demo mode: the fixed demo caregiver (lib/demo-mode.ts), from the server.
async function loadDemoCaregiver(): Promise<Caregiver> {
  const response = await fetch("/api/demo/session");
  if (!response.ok) throw new Error("Demo caregiver unavailable");
  return (await response.json()).caregiver;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>;
}
