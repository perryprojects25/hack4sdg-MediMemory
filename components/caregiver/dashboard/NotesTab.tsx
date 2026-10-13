"use client";

// Notes: short caregiver observations ("Mum felt dizzy Tuesday").
// These are included in the AI summary for the doctor.

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import { addNote, deleteNote } from "@/lib/caregiver-data";
import type { Patient } from "@/lib/types";
import { Card, ErrorBox, Field, PrimaryButton, inputClass } from "@/components/ui";
import type { PatientData } from "./usePatientData";

export default function NotesTab({
  patient,
  data,
  reload,
}: {
  patient: Patient;
  data: PatientData;
  reload: () => Promise<void>;
}) {
  const { t, lang } = useLanguage();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      await addNote(patient.id, note.trim());
      setNote("");
      await reload();
    } catch (err) {
      console.error(err);
      setFailed(true);
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm(t("noteDeleteConfirm"))) return;
    try {
      await deleteNote(id);
      await reload();
    } catch {
      setFailed(true);
    }
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(iso));

  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-900">{t("notesTitle")}</h2>
      <p className="mt-1 text-lg text-slate-700">{t("notesIntro")}</p>

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <Field label={t("notesNew")} hint={t("notesHint")}>
          {(props) => (
            <textarea
              {...props}
              className={`${inputClass} min-h-28 py-3`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          )}
        </Field>
        {failed && <ErrorBox>{t("genericError")}</ErrorBox>}
        <PrimaryButton type="submit" disabled={saving || !note.trim()} className="self-start">
          {saving ? t("saving") : `+ ${t("notesAdd")}`}
        </PrimaryButton>
      </form>

      {data.notes.length === 0 ? (
        <p className="mt-6 text-lg text-slate-700">{t("notesEmpty")}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 p-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">{formatDate(n.created_at)}</p>
                <p className="mt-1 whitespace-pre-wrap text-lg text-slate-900">{n.note}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(n.id)}
                aria-label={t("noteDelete")}
                className="min-h-11 min-w-11 rounded-full border-2 border-slate-400 text-lg text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
