import { TIME_ZONE } from "./dose-rules";
import type { Lang } from "./translations";

// "2026-10-13T00:05:00Z" -> "8:05 am" (English) or "上午8:05" (Chinese), in Hong Kong time.
export function formatTime(iso: string, lang: Lang): string {
  const text = new Intl.DateTimeFormat(lang === "zh" ? "zh-HK" : "en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
  return lang === "en" ? text.replace("AM", "am").replace("PM", "pm") : text;
}

// Hour of the day in Hong Kong (0-23), used for "Good morning".
export function hongKongHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(date)
  );
}
