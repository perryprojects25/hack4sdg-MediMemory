"use client";

// "Delete my account": removes the caregiver's account and everyone they look after.
// The caregiver must type their email first, because it cannot be undone.

import { useState } from "react";
import { UserX } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Card, ErrorBox, Field, inputClass } from "@/components/ui";

// Disabled for hackathon demo: not shown when DEMO_MODE is on.
export default function DeleteAccount({ email }: { email: string }) {
  const { t } = useLanguage();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    if (!matches) return;
    setDeleting(true);
    setFailed(false);
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);

      // The account is gone: clear this device and go back to the sign-in page.
      await supabase.auth.signOut({ scope: "local" });
      try {
        localStorage.removeItem("medimemory-selected-patient");
        localStorage.removeItem("medimemory-ai-consent");
      } catch {}
      window.location.replace("/caregiver?accountDeleted=1");
    } catch (err) {
      console.error(err);
      setFailed(true);
      setDeleting(false);
    }
  }

  return (
    <Card className="border-red-700">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-red-900">
        <UserX aria-hidden="true" className="h-6 w-6" />
        {t("accTitle")}
      </h2>
      <p className="mt-2 text-lg text-slate-900">{t("accText")}</p>
      <div className="mt-4 max-w-md">
        <Field label={t("accConfirmLabel", { email })}>
          {(props) => (
            <input
              {...props}
              type="email"
              inputMode="email"
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
        {deleting ? t("saving") : t("accButton")}
      </button>
    </Card>
  );
}
