"use client";

// Doctor summary: generate with AI, REVIEW it, then create a shareable doctor link.
// Includes a one-time consent notice about sending de-identified data to the AI provider.

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DEMO_MODE } from "@/lib/demo-mode";
import { addDays, hongKongDate } from "@/lib/doses";
import type { SummaryContent } from "@/lib/summary";
import type { Patient } from "@/lib/types";
import SummaryView from "@/components/SummaryView";
import { Card, ErrorBox, Field, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import AiConsentCard, { hasAiConsent } from "./AiConsent";

const PERIODS = [7, 14, 30] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SavedSummary = {
  id: string;
  period_start: string;
  period_end: string;
  created_at: string;
  share_token: string | null;
  doctor_email: string | null;
};

export default function SummaryTab({ patient }: { patient: Patient }) {
  const { t, lang } = useLanguage();
  const [consented, setConsented] = useState(false);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [summaryLang, setSummaryLang] = useState<"en" | "zh">("en");
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<TranslationKey | null>(null);
  const [draft, setDraft] = useState<SummaryContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedSummary[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [doctorEmail, setDoctorEmail] = useState("");

  const loadSaved = useCallback(async () => {
    const { data } = await getSupabaseBrowser()
      .from("summaries")
      .select("id, period_start, period_end, created_at, share_token, doctor_email")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false });
    setSaved((data as SavedSummary[]) ?? []);
  }, [patient.id]);

  useEffect(() => {
    async function start() {
      await Promise.resolve();
      setConsented(hasAiConsent());
      await loadSaved();
    }
    start();
  }, [loadSaved]);

  async function generate() {
    setGenerating(true);
    setProblem(null);
    setDraft(null);
    try {
      // Demo mode: no sign-in token; the server uses the demo caregiver.
      // Otherwise (disabled for hackathon demo): send the caregiver's sign-in token.
      const token = DEMO_MODE ? "" : ((await getSupabaseBrowser().auth.getSession()).data.session?.access_token ?? "");
      const end = hongKongDate(new Date());
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ patientId: patient.id, start: addDays(end, -(days - 1)), end, language: summaryLang }),
      });
      const body = await response.json();
      if (response.ok) setDraft(body as SummaryContent);
      else setProblem("sumFailed"); // AI problems never reach here: the built-in summary is used instead
    } catch {
      setProblem("sumFailed");
    }
    setGenerating(false);
  }

  async function createLink() {
    if (!draft) return;
    const email = doctorEmail.trim().toLowerCase();
    if (email && !EMAIL_PATTERN.test(email)) {
      setProblem("errEmailInvalid");
      return;
    }
    setSaving(true);
    setProblem(null);
    const { error } = await getSupabaseBrowser().from("summaries").insert({
      patient_id: patient.id,
      period_start: draft.period.start,
      period_end: draft.period.end,
      content_json: draft,
      doctor_email: email || null, // the doctor sees it in their list after signing in
    });
    setSaving(false);
    if (error) {
      console.error(error);
      setProblem("genericError");
      return;
    }
    setDraft(null);
    setDoctorEmail("");
    await loadSaved();
  }

  // Revoking removes both the link and the doctor's access.
  async function revoke(id: string) {
    if (!window.confirm(t("sumRevokeConfirm"))) return;
    await getSupabaseBrowser().from("summaries").update({ share_token: null, doctor_email: null }).eq("id", id);
    await loadSaved();
  }

  async function shareWith(id: string, email: string) {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(clean)) return false;
    const { error } = await getSupabaseBrowser().from("summaries").update({ doctor_email: clean }).eq("id", id);
    if (!error) await loadSaved();
    return !error;
  }

  async function copy(item: SavedSummary) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/doctor/${item.share_token}`);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  const fmt = (date: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${date.slice(0, 10)}T00:00:00Z`)
    );

  // Consent notice before the first summary (third-party AI processing).
  if (!consented) return <AiConsentCard onAgree={() => setConsented(true)} />;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="text-2xl font-bold text-slate-900">🩺 {t("sumTabTitle")}</h2>
        <p className="mt-1 text-lg text-slate-700">{t("sumTabIntro")}</p>

        <fieldset className="mt-4">
          <legend className="text-lg font-semibold text-slate-900">{t("sumPeriod")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <label
                key={p}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-slate-400 px-4 text-lg has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-300"
              >
                <input type="radio" name="period" className="sr-only" checked={days === p} onChange={() => setDays(p)} />
                {t("sumLastDays", { n: p })}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-lg font-semibold text-slate-900">{t("sumLanguage")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["en", "zh"] as const).map((l) => (
              <label
                key={l}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-slate-400 px-4 text-lg has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal-300"
              >
                <input type="radio" name="sumlang" className="sr-only" checked={summaryLang === l} onChange={() => setSummaryLang(l)} />
                {l === "en" ? "English" : "中文"}
              </label>
            ))}
          </div>
        </fieldset>

        <PrimaryButton className="mt-6" onClick={generate} disabled={generating}>
          {generating ? t("sumGenerating") : `✨ ${t("sumGenerate")}`}
        </PrimaryButton>
        {generating && (
          <p role="status" className="mt-3 text-lg text-slate-700">
            {t("sumWait")}
          </p>
        )}
        {problem && (
          <div className="mt-4 flex flex-col gap-3">
            <ErrorBox>{t(problem)}</ErrorBox>
            <SecondaryButton className="self-start" onClick={generate}>
              {t("tryAgain")}
            </SecondaryButton>
          </div>
        )}
      </Card>

      {/* Review step: the caregiver checks the summary before anything is shared */}
      {draft && (
        <Card className="border-teal-700">
          {draft.writtenBy === "automatic" && (
            <p className="mb-4 rounded-xl border-2 border-amber-600 bg-amber-50 p-3 text-lg text-amber-950">
              {t("sumAutoNote")}
            </p>
          )}
          <p className="mb-4 rounded-xl bg-teal-50 p-3 text-lg font-semibold text-teal-950">👀 {t("sumReview")}</p>
          <SummaryView content={draft} />
          <div className="mt-6 max-w-md">
            <Field label={t("sumDoctorEmail")} hint={t("sumDoctorEmailHint")}>
              {(props) => (
                <input
                  {...props}
                  type="email"
                  inputMode="email"
                  className={inputClass}
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={createLink} disabled={saving}>
              {saving ? t("saving") : `🔗 ${t("sumCreateLink")}`}
            </PrimaryButton>
            <SecondaryButton onClick={() => setDraft(null)} disabled={saving}>
              {t("sumDiscard")}
            </SecondaryButton>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("sumLinksTitle")}</h2>
        {saved.length === 0 ? (
          <p className="mt-2 text-lg text-slate-700">{t("sumLinksEmpty")}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {saved.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-900">
                    {fmt(item.period_start)} – {fmt(item.period_end)}
                  </p>
                  <p className="text-base text-slate-700">
                    {item.share_token ? t("sumLinkActive") : `⛔ ${t("sumLinkRevoked")}`}
                  </p>
                  {item.share_token && (
                    <ShareWithDoctor current={item.doctor_email} onShare={(email) => shareWith(item.id, email)} />
                  )}
                </div>
                {item.share_token && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/doctor/${item.share_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-12 items-center rounded-full bg-teal-700 px-5 text-lg font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                    >
                      {t("sumOpen")} ↗
                    </a>
                    <SecondaryButton className="min-h-12 text-lg" onClick={() => copy(item)}>
                      {copiedId === item.id ? `✅ ${t("s4Copied")}` : `📋 ${t("s4Copy")}`}
                    </SecondaryButton>
                    <button
                      type="button"
                      onClick={() => revoke(item.id)}
                      className="min-h-12 rounded-full border-2 border-red-700 px-5 text-lg font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
                    >
                      {t("sumRevoke")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// Shows who the summary is shared with, and lets the caregiver share it with a doctor's email.
function ShareWithDoctor({
  current,
  onShare,
}: {
  current: string | null;
  onShare: (email: string) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(current ?? "");
  const [invalid, setInvalid] = useState(false);

  if (!editing) {
    return (
      <p className="mt-1 text-base text-slate-800">
        👩‍⚕️ {current ? t("sumSharedWith", { email: current }) : t("sumNotShared")}{" "}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-semibold text-teal-800 underline underline-offset-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
        >
          {current ? t("sumChangeDoctor") : t("sumShareDoctor")}
        </button>
      </p>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await onShare(email);
        setInvalid(!ok);
        if (ok) setEditing(false);
      }}
    >
      <input
        type="email"
        inputMode="email"
        aria-label={t("sumDoctorEmail")}
        placeholder={t("sumDoctorEmail")}
        className={`${inputClass} min-h-12 text-lg`}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <SecondaryButton type="submit" className="min-h-12 text-lg">
        {t("sumShareSave")}
      </SecondaryButton>
      {invalid && <p className="text-base font-medium text-red-800">{t("errEmailInvalid")}</p>}
    </form>
  );
}
