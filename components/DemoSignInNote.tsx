"use client";

// Small note on sign-in screens while HACKATHON DEMO MODE is on.

import { Info } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { DEMO_MODE } from "@/lib/demo-mode";

export default function DemoSignInNote({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  if (!DEMO_MODE) return null;
  return (
    <p className={`flex items-center gap-2 text-base text-slate-700 ${className}`}>
      <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-700" />
      {t("demoSignInNote")}
    </p>
  );
}
