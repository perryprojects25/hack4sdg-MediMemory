"use client";

// Step 1: create an account / sign in with a magic link (no password).

import { useState } from "react";
import { useLanguage } from "@/lib/language";
import type { TranslationKey } from "@/lib/translations";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PENDING_NAME_KEY } from "@/lib/caregiver-data";
import { Card, ErrorBox, Field, PrimaryButton, SecondaryButton, inputClass } from "@/components/ui";
import { WizardNav } from "./Wizard";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StepAccount({
  email,
  linkExpired,
  onNext,
}: {
  email: string | null; // set when already signed in
  linkExpired: boolean;
  onNext: () => void;
}) {
  const { t } = useLanguage();

  // Already signed in: just confirm and move on.
  if (email) {
    return (
      <Card>
        <h1 className="text-3xl font-bold text-slate-900">{t("s1Title")}</h1>
        <p className="mt-4 text-xl text-slate-800">✅ {t("s1SignedInAs", { email })}</p>
        <SecondaryButton className="mt-4" onClick={() => getSupabaseBrowser().auth.signOut()}>
          {t("signOut")}
        </SecondaryButton>
        <WizardNav onNext={onNext} />
      </Card>
    );
  }

  return <SignInForm linkExpired={linkExpired} />;
}

function SignInForm({ linkExpired }: { linkExpired: boolean }) {
  const { t } = useLanguage();
  const [returning, setReturning] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: TranslationKey; email?: TranslationKey }>({});
  const [problem, setProblem] = useState<TranslationKey | null>(linkExpired ? "s1LinkExpired" : null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const newErrors: typeof errors = {};
    if (!returning && !cleanName) newErrors.name = "errNameRequired";
    if (!EMAIL_PATTERN.test(cleanEmail)) newErrors.email = "errEmailInvalid";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSending(true);
    setProblem(null);
    try {
      // Remember the name so we can save it after they click the link.
      if (!returning) localStorage.setItem(PENDING_NAME_KEY, cleanName);
    } catch {}

    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/caregiver`,
        data: returning ? undefined : { name: cleanName },
      },
    });
    setSending(false);

    if (error) {
      console.error(error);
      setProblem(error.status === 429 ? "s1TooMany" : "genericError");
      return;
    }
    setSentTo(cleanEmail);
  }

  // After sending: tell them to check their inbox.
  if (sentTo) {
    return (
      <Card>
        <div className="text-6xl" aria-hidden="true">
          📧
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("s1CheckEmail")}</h1>
        <p className="mt-4 text-xl text-slate-800" role="status">
          {t("s1CheckEmailText", { email: sentTo })}
        </p>
        <SecondaryButton className="mt-6" onClick={() => setSentTo(null)}>
          {t("s1DifferentEmail")}
        </SecondaryButton>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-3xl font-bold text-slate-900">
        {returning ? t("s1TitleReturning") : t("s1Title")}
      </h1>
      <p className="mt-2 text-xl text-slate-800">{t("s1Intro")}</p>

      <form onSubmit={send} noValidate className="mt-6 flex flex-col gap-6">
        {problem && <ErrorBox>{t(problem)}</ErrorBox>}

        {!returning && (
          <Field label={t("s1Name")} error={errors.name && t(errors.name)}>
            {(props) => (
              <input
                {...props}
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
          </Field>
        )}

        <Field label={t("s1Email")} error={errors.email && t(errors.email)}>
          {(props) => (
            <input
              {...props}
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          )}
        </Field>

        <PrimaryButton type="submit" disabled={sending}>
          {sending ? t("s1Sending") : t("s1Send")}
        </PrimaryButton>
      </form>

      <button
        type="button"
        onClick={() => {
          setReturning(!returning);
          setErrors({});
        }}
        className="mt-6 text-lg font-semibold text-teal-800 underline underline-offset-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300"
      >
        {returning ? t("s1NewAccount") : t("s1HaveAccount")}
      </button>
    </Card>
  );
}
