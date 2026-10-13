"use client";

// Doctor area (/doctor): sign in with an email link, then see every summary a
// caregiver has shared with that email. Read only. Row Level Security only lets a
// doctor read summaries whose doctor_email matches their signed-in email.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Card, ErrorBox, Field, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";

const isConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SharedSummary = {
  id: string;
  period_start: string;
  period_end: string;
  created_at: string;
  share_token: string;
  patient: { name: string; age: number | null } | null;
};

export default function DoctorHome() {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = still checking

  useEffect(() => {
    if (!isConfigured) return;
    const { data } = getSupabaseBrowser().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">🩺 {t("doctorInfoTitle")}</h1>
      <div className="mt-6">
        {!isConfigured ? (
          <ErrorBox>{t("notConfigured")}</ErrorBox>
        ) : user === undefined ? (
          <p role="status" className="text-xl text-slate-800">
            {t("loading")}
          </p>
        ) : user === null ? (
          <DoctorSignIn />
        ) : (
          <SharedList email={user.email ?? ""} />
        )}
      </div>
    </main>
  );
}

function DoctorSignIn() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<TranslationKey | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(clean)) return setError("errEmailInvalid");
    setSending(true);
    setError(null);
    const { error: authError } = await getSupabaseBrowser().auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: `${window.location.origin}/doctor` },
    });
    setSending(false);
    if (authError) return setError(authError.status === 429 ? "s1TooMany" : "genericError");
    setSentTo(clean);
  }

  if (sentTo) {
    return (
      <Card>
        <p className="text-5xl" aria-hidden="true">📧</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">{t("s1CheckEmail")}</h2>
        <p className="mt-3 text-xl text-slate-800" role="status">
          {t("docCheckEmail", { email: sentTo })}
        </p>
        <SecondaryButton className="mt-6" onClick={() => setSentTo(null)}>
          {t("s1DifferentEmail")}
        </SecondaryButton>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-900">{t("docSignInTitle")}</h2>
      <p className="mt-2 text-lg text-slate-800">{t("docSignInText")}</p>
      <form onSubmit={send} noValidate className="mt-6 flex flex-col gap-5">
        <Field label={t("docEmail")} error={error ? t(error) : undefined}>
          {(props) => (
            <input
              {...props}
              type="email"
              inputMode="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <PrimaryButton type="submit" disabled={sending}>
          {sending ? t("s1Sending") : t("s1Send")}
        </PrimaryButton>
      </form>
    </Card>
  );
}

function SharedList({ email }: { email: string }) {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<SharedSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await getSupabaseBrowser()
        .from("summaries")
        .select("id, period_start, period_end, created_at, share_token, patient:content_json->patient")
        .eq("doctor_email", email.toLowerCase())
        .not("share_token", "is", null)
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        setFailed(true);
      }
      setItems((data as unknown as SharedSummary[]) ?? []);
    }
    load();
  }, [email]);

  const fmt = (date: string) =>
    new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(date.length === 10 ? `${date}T12:00:00+08:00` : date));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg text-slate-800">{t("s1SignedInAs", { email })}</p>
          <SecondaryButton onClick={() => getSupabaseBrowser().auth.signOut()}>{t("signOut")}</SecondaryButton>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-slate-900">{t("docSharedTitle")}</h2>
        {failed && (
          <div className="mt-4">
            <ErrorBox>{t("genericError")}</ErrorBox>
          </div>
        )}
        {items === null ? (
          <p role="status" className="mt-4 text-lg text-slate-800">
            {t("loading")}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-lg text-slate-700">{t("docSharedEmpty", { email })}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="text-xl font-bold text-slate-900">
                    {item.patient?.name ?? "—"}
                    {item.patient?.age ? ` · ${t("homeAge", { age: item.patient.age })}` : ""}
                  </p>
                  <p className="text-lg text-slate-800">
                    {fmt(item.period_start)} – {fmt(item.period_end)}
                  </p>
                  <p className="text-base text-slate-700">{t("docSharedOn", { date: fmt(item.created_at) })}</p>
                </div>
                <Link
                  href={`/doctor/${item.share_token}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-teal-700 px-6 text-lg font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
                >
                  {t("sumOpen")} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
