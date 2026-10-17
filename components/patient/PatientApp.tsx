"use client";

// The patient check-in screen: the heart of the app.
// Shows ONE thing at a time: the PIN pad, the next dose due, or "All done for now".

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import type { Dose, LogResult, PatientInfo } from "@/lib/patient-server";
import { speak } from "@/lib/speech";
import { formatTime } from "@/lib/time";
import { DEMO_MODE } from "@/lib/demo-mode";
import PinScreen from "./PinScreen";
import UsernameScreen from "./UsernameScreen";
import DoseScreen from "./DoseScreen";
import { AllDoneScreen, Center, MessageScreen } from "./Screens";

// The device remembers the patient id and PIN, so the PIN is only typed once.
// (Prototype: kept in this browser's storage. A real app would use a secure device token.)
const DEVICE_KEY = "medimemory-patient";
// How often the screen checks for a new dose while it is open.
const REFRESH_SECONDS = 30;

type Credentials = { id: string; pin: string };

type View =
  | { kind: "loading" }
  | { kind: "username" } // sign in without a link: username first...
  | { kind: "loginPin"; username: string; wrong: boolean } // ...then the PIN
  | { kind: "pin"; id: string; wrongPin: boolean } // opened from the personal link
  | { kind: "problem" }
  | { kind: "home" }
  | { kind: "success"; name: string; time: string }
  | { kind: "already"; time: string }
  | { kind: "snoozed"; time: string };

function readDevice(): Credentials | null {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveDevice(creds: Credentials) {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(creds));
  } catch {}
}

async function post<T>(path: string, body: object): Promise<{ status: number; data: T }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

export default function PatientApp({ linkId }: { linkId: string | null }) {
  const { t, lang, setLang } = useLanguage();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [busy, setBusy] = useState(false);

  // Ask the server for today's doses. Returns false if the PIN no longer works.
  const refresh = useCallback(async (c: Credentials): Promise<boolean> => {
    const { status, data } = await post<{ patient: PatientInfo; doses: Dose[] }>(
      "/api/patient/today",
      c
    );
    if (status === 401) return false;
    if (status !== 200) throw new Error("server");
    setPatient(data.patient);
    setDoses(data.doses);
    return true;
  }, []);

  // On first open: use the remembered device, or ask for the PIN.
  useEffect(() => {
    async function start() {
      await Promise.resolve(); // let the first screen paint before we start
      const saved = readDevice();
      const id = linkId ?? saved?.id ?? null;
      // Demo mode: no username, just the PIN pad (any 4 digits work).
      if (!id) return setView(DEMO_MODE ? { kind: "loginPin", username: "", wrong: false } : { kind: "username" });
      if (!saved || saved.id !== id) return setView({ kind: "pin", id, wrongPin: false });

      try {
        if (await refresh(saved)) {
          setCreds(saved);
          setView({ kind: "home" });
        } else {
          setView({ kind: "pin", id, wrongPin: false }); // the PIN was changed
        }
      } catch {
        setView({ kind: "problem" });
      }
    }
    start();
  }, [linkId, refresh]);

  // Each new screen starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.kind]);

  // While the home screen is open, check for due doses every 30 seconds.
  useEffect(() => {
    if (!creds || view.kind !== "home") return;
    const timer = setInterval(() => refresh(creds).catch(() => {}), REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [creds, view.kind, refresh]);

  async function submitPin(id: string, pin: string) {
    setBusy(true);
    try {
      const attempt = { id, pin };
      const { status, data } = await post<{ patient: PatientInfo; doses: Dose[] }>(
        "/api/patient/today",
        attempt
      );
      if (status === 401) return setView({ kind: "pin", id, wrongPin: true });
      if (status !== 200) return setView({ kind: "problem" });

      saveDevice(attempt);
      setCreds(attempt);
      setPatient(data.patient);
      setDoses(data.doses);
      setLang(data.patient.preferred_language); // show the screen in their language
      setView({ kind: "home" });
    } catch {
      setView({ kind: "problem" });
    } finally {
      setBusy(false);
    }
  }

  // Sign in with username + PIN (no link). Finds the patient, then continues as with a link.
  async function submitLogin(username: string, pin: string) {
    setBusy(true);
    try {
      const { status, data } = await post<{ id: string }>("/api/patient/login", { username, pin });
      if (status === 401) return setView({ kind: "loginPin", username, wrong: true });
      if (status !== 200) return setView({ kind: "problem" });
      setBusy(false);
      await submitPin(data.id, pin);
    } catch {
      setView({ kind: "problem" });
    } finally {
      setBusy(false);
    }
  }

  // "Not you?": forget this device and go back to the sign-in screen.
  function switchPerson() {
    try {
      localStorage.removeItem(DEVICE_KEY);
    } catch {}
    window.speechSynthesis?.cancel();
    setCreds(null);
    setPatient(null);
    setDoses([]);
    if (linkId) window.history.replaceState(null, "", "/patient");
    setView(DEMO_MODE ? { kind: "loginPin", username: "", wrong: false } : { kind: "username" });
  }

  // "I took it" or "Remind me later".
  async function answer(dose: Dose, action: "taken" | "snooze", viaVoice = false) {
    if (!creds || busy) return; // busy also stops an accidental double tap
    setBusy(true);
    try {
      const { status, data } = await post<LogResult>("/api/patient/log", {
        ...creds,
        medicationId: dose.medicationId,
        scheduledFor: dose.scheduledFor,
        action,
        voice: viaVoice,
      });
      if (status === 401) return setView({ kind: "pin", id: creds.id, wrongPin: false });
      if (status >= 500) return setView({ kind: "problem" });

      if (data.result === "taken") {
        const time = formatTime(data.takenAt, lang);
        speak(`${t("pWellDone")} ${t("pTakenAt", { name: dose.name, time })}`, lang);
        setView({ kind: "success", name: dose.name, time });
      } else if (data.result === "alreadyTaken") {
        const time = formatTime(data.takenAt, lang);
        speak(t("pAlreadyText", { time }), lang);
        setView({ kind: "already", time });
      } else if (data.result === "snoozed") {
        const time = formatTime(data.until, lang);
        speak(t("pSnoozedText", { time }), lang);
        setView({ kind: "snoozed", time });
      }
      // Anything else (e.g. the dose was closed meanwhile): just show the latest list.
      await refresh(creds);
    } catch {
      setView({ kind: "problem" });
    } finally {
      setBusy(false);
    }
  }

  async function backHome() {
    window.speechSynthesis?.cancel();
    setView({ kind: "home" });
    if (creds) await refresh(creds).catch(() => setView({ kind: "problem" }));
  }

  switch (view.kind) {
    case "loading":
      return <Center><p className="text-3xl text-slate-800" role="status">{t("loading")}</p></Center>;

    case "username":
      return <UsernameScreen onNext={(username) => setView({ kind: "loginPin", username, wrong: false })} />;

    case "loginPin":
      return (
        <PinScreen
          wrongPin={view.wrong}
          wrongMessage={t("pWrongLogin")}
          busy={busy}
          username={view.username}
          onChangeUsername={() => setView({ kind: "username" })}
          onSubmit={(pin) => submitLogin(view.username, pin)}
        />
      );

    case "pin":
      return (
        <PinScreen
          wrongPin={view.wrongPin}
          busy={busy}
          onSubmit={(pin) => submitPin(view.id, pin)}
        />
      );

    case "problem":
      return (
        <MessageScreen
          icon="🙏"
          title={t("pProblem")}
          buttonLabel={t("tryAgain")}
          onButton={() => location.reload()}
        />
      );

    case "success":
      return (
        <MessageScreen
          icon="✅"
          title={t("pWellDone")}
          text={t("pTakenAt", { name: view.name, time: view.time })}
          buttonLabel={t("pOk")}
          onButton={backHome}
          autoCloseSeconds={12}
          tone="green"
        />
      );

    case "already":
      return (
        <MessageScreen
          icon="✅"
          title={t("pAlreadyTitle")}
          text={t("pAlreadyText", { time: view.time })}
          buttonLabel={t("pOk")}
          onButton={backHome}
          tone="blue"
        />
      );

    case "snoozed":
      return (
        <MessageScreen
          icon="⏰"
          title={t("pSnoozedText", { time: view.time })}
          buttonLabel={t("pOk")}
          onButton={backHome}
          autoCloseSeconds={12}
        />
      );

    case "home": {
      const due = doses.filter((d) => d.status === "due");
      if (due.length > 0) {
        return (
          <DoseScreen
            // A new key for each dose, so it is read aloud when it appears.
            key={`${due[0].medicationId}-${due[0].scheduledFor}`}
            dose={due[0]}
            position={due.length > 1 ? { n: 1, total: due.length } : null}
            busy={busy}
            onTaken={(viaVoice) => answer(due[0], "taken", viaVoice)}
            onSnooze={() => answer(due[0], "snooze")}
          />
        );
      }

      // Nothing due: the next medicine and today's list.
      return (
        <AllDoneScreen patientName={patient?.name ?? ""} doses={doses} onSwitchPerson={switchPerson} />
      );
    }
  }
}
