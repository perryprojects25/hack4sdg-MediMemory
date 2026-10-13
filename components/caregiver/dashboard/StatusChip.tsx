"use client";

// Colour-coded dose status. Always icon + word, never colour alone.
// green = taken, amber = late, red = missed, grey = upcoming.

import { useLanguage } from "@/lib/language";
import type { DoseStatus } from "@/lib/doses";
import type { TranslationKey } from "@/lib/translations";

const STYLES: Record<DoseStatus, { icon: string; key: TranslationKey; className: string }> = {
  taken: { icon: "✓", key: "stTaken", className: "border-green-700 bg-green-100 text-green-900" },
  late: { icon: "⏰", key: "stLate", className: "border-amber-600 bg-amber-100 text-amber-900" },
  missed: { icon: "✕", key: "stMissed", className: "border-red-700 bg-red-100 text-red-900" },
  skipped: { icon: "–", key: "stSkipped", className: "border-slate-500 bg-slate-100 text-slate-800" },
  due: { icon: "🔔", key: "stDue", className: "border-sky-700 bg-sky-100 text-sky-900" },
  snoozed: { icon: "💤", key: "stSnoozed", className: "border-slate-500 bg-slate-100 text-slate-800" },
  upcoming: { icon: "🕗", key: "stUpcoming", className: "border-slate-400 bg-slate-100 text-slate-800" },
};

export default function StatusChip({ status }: { status: DoseStatus }) {
  const { t } = useLanguage();
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 px-3 py-1 text-base font-semibold ${style.className}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      {t(style.key)}
    </span>
  );
}

