"use client";

// Doctor summary: generate with AI, REVIEW it, then create a shareable doctor link.
// Includes a one-time consent notice about sending de-identified data to DeepSeek.

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { addDays, hongKongDate } from "@/lib/doses";
import type { SummaryContent } from "@/lib/summary";
import type { Patient } from "@/lib/types";
import SummaryView from "@/components/SummaryView";
import { Card, ErrorBox, PrimaryButton, SecondaryButton } from "@/components/ui";

const CONSENT_KEY = "medimemory-ai-consent";
const PERIODS = [7, 14, 30] as const;

type SavedSummary = {
  id: string;
  period_start: string;
  period_end: string;
  created_at: string;
  share_token: string | null;
};

export default function SummaryTab({ patient }: { patient: Patient }) {
  const { t, lang } = useLanguage();
  const [consented, setConsented] = useState(false);
  const [consentTicked, setConsentTicked] = useState(false);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [summaryLang, setSummaryLang] = useState<"en" | "zh">("en");
  const [generating, setGenerating] = useState(false);
  const [problem, setProblem] = useState<TranslationKey | null>(null);
  const [draft, setDraft] = useState<SummaryContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedSummary[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    const { data } = await getSupabaseBrowser()
      .from("summaries")
      .select("id, period_start, period_end, created_at, share_token")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false });
    setSaved((data as SavedSummary[]) ?? []);
  }, [patient.id]);

  useEffect(() => {
    async function start() {
      await Promise.resolve();
      try {
        setConsented(localStorage.getItem(CONSENT_KEY) === "yes");
      } catch {}
      await loadSaved();
    }
    start();
  }, [loadSaved]);

  function giveConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, "yes");
    } catch {}
    setConsented(true);
  }

  async function generate() {
    setGenerating(true);
    setProblem(null);
    setDraft(null);
    try {
      const { data: session } = await getSupabaseBrowser().auth.getSession();
      const end = hongKongDate(new Date());
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ patientId: patient.id, start: addDays(end, -(days - 1)), end, language: summaryLang }),
      });
      const body = await response.json();
      if (response.ok) setDraft(body as SummaryContent);
      else setProblem(body.error === "ai_not_configured" ? "sumNotConfigured" : "sumFailed");
    } catch {
      setProblem("sumFailed");
    }
    setGenerating(false);
  }

  async function createLink() {
    if (!draft) return;
    setSaving(true);
    setProblem(null);
    const { error } = await getSupabaseBrowser().from("summaries").insert({
      patient_id: patient.id,
      period_start: draft.period.start,
      period_end: draft.period.end,
      content_json: draft,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      setProblem("genericError");
      return;
    }
    setDraft(null);
    await loadSaved();
  }

  async function revoke(id: string) {
    if (!window.confirm(t("sumRevokeConfirm"))) return;
    await getSupabaseBrowser().from("summaries").update({ share_token: null }).eq("id", id);
    await loadSaved();
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
  if (!consented) {
    return (
      <Card className="border-sky-700 bg-sky-50">
        <h2 className="text-2xl font-bold text-slate-900">🔒 {t("consentTitle")}</h2>
        <p className="mt-3 text-lg text-slate-900">{t("consentText1")}</p>
        <p className="mt-2 text-lg text-slate-900">{t("consentText2")}</p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-lg text-slate-900">
          <input
            type="checkbox"
            checked={consentTicked}
            onChange={(e) => setConsentTicked(e.target.checked)}
            className="mt-1 h-6 w-6 accent-teal-700"
          />
          {t("consentCheck")}
        </label>
        <PrimaryButton className="mt-4" disabled={!consentTicked} onClick={giveConsent}>
          {t("consentContinue")}
        </PrimaryButton>
      </Card>
    );
  }

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
          <p className="mb-4 rounded-xl bg-teal-50 p-3 text-lg font-semibold text-teal-950">👀 {t("sumReview")}</p>
          <SummaryView content={draft} />
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
