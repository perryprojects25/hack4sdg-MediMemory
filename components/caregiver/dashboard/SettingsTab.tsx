"use client";

// Settings: patient details, patient access (PIN / link / QR), demo tools, sign out.

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import {
  AccessTakenError,
  USERNAME_PATTERN,
  saveAccess,
  deletePatient,
  saveNewPin,
  suggestUsername,
} from "@/lib/caregiver-data";
import { DEMO_MARK, addTestDose, loadDemo, removeDemo } from "@/lib/demo-data";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Caregiver, Patient } from "@/lib/types";
import { Card, ErrorBox, Field, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import { Trash2 } from "lucide-react";
import PatientAccess from "../PatientAccess";

export default function SettingsTab({
  caregiver,
  patient,
  hasDemo,
  onEdit,
  onPatientChanged,
  onEverythingChanged,
  onDeleted,
  reload,
}: {
  caregiver: Caregiver;
  patient: Patient;
  hasDemo: boolean;
  onEdit: () => void;
  onPatientChanged: (patient: Patient) => void;
  onEverythingChanged: () => Promise<void>;
  onDeleted: (name: string) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<TranslationKey | null>(null);
  const [username, setUsername] = useState(patient.username ?? suggestUsername(patient.name));

  async function run(name: string, action: () => Promise<string | null>) {
    setBusy(name);
    setMessage(null);
    setProblem(null);
    try {
      setMessage(await action());
    } catch (err) {
      console.error(err);
      setProblem(err instanceof AccessTakenError ? "errAccessTaken" : "genericError");
    }
    setBusy(null);
  }

  const isDemoPatient = patient.notes === DEMO_MARK;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="text-2xl font-bold text-slate-900">👤 {t("setPatientTitle")}</h2>
        <p className="mt-2 text-lg text-slate-800">
          {patient.name}
          {patient.age ? ` · ${t("homeAge", { age: patient.age })}` : ""} ·{" "}
          {patient.preferred_language === "zh" ? t("langZh") : t("langEn")}
        </p>
        {patient.notes && <p className="text-base text-slate-700">{patient.notes}</p>}
        <SecondaryButton className="mt-4" onClick={onEdit}>
          ✏️ {t("homeEdit")}
        </SecondaryButton>
      </Card>

      <Card>
        <h2 className="mb-4 text-2xl font-bold text-slate-900">📱 {t("homeAccess", { name: patient.name })}</h2>
        <form
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!USERNAME_PATTERN.test(username)) return setProblem("errUsername");
            run("username", async () => {
              onPatientChanged(await saveAccess(patient.id, username, patient.pin ?? ""));
              return t("setUsernameDone");
            });
          }}
        >
          <div className="flex-1">
            <Field label={t("s4ChooseUsername")} hint={t("s4UsernameHint")}>
              {(props) => (
                <input
                  {...props}
                  className={`${inputClass} font-mono`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20))}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              )}
            </Field>
          </div>
          <SecondaryButton type="submit" disabled={busy !== null || username === patient.username}>
            {busy === "username" ? t("saving") : t("setUsernameSave")}
          </SecondaryButton>
        </form>
        <PatientAccess
          patientId={patient.id}
          username={patient.username ?? ""}
          pin={patient.pin ?? ""}
          onNewPin={() =>
            run("pin", async () => {
              if (!window.confirm(t("setNewPinConfirm", { name: patient.name }))) return null;
              onPatientChanged(await saveNewPin(patient.id, patient.username ?? username));
              return t("setNewPinDone");
            })
          }
        />
      </Card>

      <Card className="border-violet-700 bg-violet-50">
        <h2 className="text-2xl font-bold text-slate-900">🎬 {t("demoTitle")}</h2>
        <p className="mt-2 text-lg text-slate-800">{t("demoText")}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <PrimaryButton
            disabled={busy !== null}
            onClick={() =>
              run("demo", async () => {
                if (hasDemo && !window.confirm(t("demoResetConfirm"))) return null;
                await loadDemo(caregiver.id);
                await onEverythingChanged();
                return t("demoLoaded");
              })
            }
          >
            {busy === "demo" ? t("demoLoading") : hasDemo ? `🔄 ${t("demoReset")}` : `▶ ${t("demoLoad")}`}
          </PrimaryButton>
          {hasDemo && (
            <SecondaryButton
              disabled={busy !== null}
              onClick={() =>
                run("remove", async () => {
                  if (!window.confirm(t("demoRemoveConfirm"))) return null;
                  await removeDemo(caregiver.id);
                  await onEverythingChanged();
                  return t("demoRemoved");
                })
              }
            >
              🗑 {t("demoRemove")}
            </SecondaryButton>
          )}
        </div>

        <div className="mt-6 border-t-2 border-violet-200 pt-4">
          <h3 className="text-xl font-semibold text-slate-900">⏱ {t("testDoseTitle")}</h3>
          <p className="mt-1 text-lg text-slate-800">{t("testDoseText", { name: patient.name })}</p>
          <SecondaryButton
            className="mt-3"
            disabled={busy !== null}
            onClick={() =>
              run("test", async () => {
                const time = await addTestDose(patient.id);
                await reload();
                return t("testDoseDone", { time, name: patient.name });
              })
            }
          >
            {busy === "test" ? t("saving") : `+ ${t("testDoseButton")}`}
          </SecondaryButton>
        </div>
        {isDemoPatient && <p className="mt-4 text-base text-violet-950">ℹ️ {t("demoIsFictional")}</p>}
      </Card>

      {message && (
        <p role="status" className="rounded-xl border-2 border-green-700 bg-green-50 p-4 text-lg font-semibold text-green-900">
          ✅ {message}
        </p>
      )}
      {problem && <ErrorBox>{t(problem)}</ErrorBox>}

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/about" className="text-lg font-semibold text-teal-800 underline underline-offset-4">
            ℹ️ {t("aboutLink")}
          </Link>
          <SecondaryButton onClick={() => getSupabaseBrowser().auth.signOut()}>{t("signOut")}</SecondaryButton>
        </div>
        <p className="mt-3 text-base text-slate-700">{t("s1SignedInAs", { email: caregiver.email })}</p>
      </Card>

      <DeletePerson patient={patient} onDeleted={onDeleted} />
    </div>
  );
}

// Delete this person and all their data. Typing the name is required, because it cannot be undone.
function DeletePerson({ patient, onDeleted }: { patient: Patient; onDeleted: (name: string) => Promise<void> }) {
  const { t } = useLanguage();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const matches = typed.trim().toLowerCase() === patient.name.trim().toLowerCase();

  async function remove() {
    if (!matches) return;
    setDeleting(true);
    setFailed(false);
    try {
      await deletePatient(patient.id);
      await onDeleted(patient.name);
    } catch (err) {
      console.error(err);
      setFailed(true);
      setDeleting(false);
    }
  }

  return (
    <Card className="border-red-700">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-red-900">
        <Trash2 aria-hidden="true" className="h-6 w-6" />
        {t("delTitle", { name: patient.name })}
      </h2>
      <p className="mt-2 text-lg text-slate-900">{t("delText", { name: patient.name })}</p>
      <div className="mt-4 max-w-md">
        <Field label={t("delConfirmLabel", { name: patient.name })}>
          {(props) => (
            <input
              {...props}
              className={inputClass}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          )}
        </Field>
      </div>
      {failed && (
        <div className="mt-4">
          <ErrorBox>{t("genericError")}</ErrorBox>
        </div>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={!matches || deleting}
        className="mt-4 min-h-14 rounded-full bg-red-700 px-8 text-xl font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
      >
        {deleting ? t("saving") : t("delButton")}
      </button>
    </Card>
  );
}
