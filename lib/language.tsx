"use client";

// Language switcher: remembers the chosen language on this device
// and gives every page a t("key") function to look up text.

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";

const STORAGE_KEY = "medimemory-lang";
const CHANGE_EVENT = "medimemory-lang-change";

// Read the saved language. Storage can be blocked (e.g. private browsing): use English then.
function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

// Re-render when the language changes in this tab or another tab.
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type LanguageContextValue = {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // On the server we always render English; the browser then switches to the saved language.
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);

  // Keep the <html lang> attribute correct, which helps screen readers and voices.
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-HK" : "en";
  }, [lang]);

  function toggleLang() {
    try {
      localStorage.setItem(STORAGE_KEY, lang === "en" ? "zh" : "en");
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const t = (key: TranslationKey) => translations[lang][key];

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
