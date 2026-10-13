"use client";

// Voice features using only what the browser has built in (no paid services).
// - speak(): reads text aloud with speechSynthesis.
// - startListening(): listens for "yes" / "taken" (or Cantonese 食咗) with the Web Speech API.
// Voice is always optional: every action also has an on-screen button.

import type { Lang } from "./translations";

const VOICE_LANG: Record<Lang, string> = { en: "en-GB", zh: "zh-HK" };

export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // stop anything still being read

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG[lang];
  utterance.rate = 0.9; // a little slower than normal

  // Prefer a Cantonese (zh-HK) voice for Chinese if the device has one.
  const voices = synth.getVoices();
  const voice =
    voices.find((v) => v.lang.replace("_", "-") === VOICE_LANG[lang]) ??
    voices.find((v) => v.lang.startsWith(lang));
  if (voice) utterance.voice = voice;

  synth.speak(utterance);
}

// Words that count as "yes, I took it".
const YES_WORDS = [
  "yes", "yeah", "yep", "taken", "took", "done",
  "食咗", "食左", "食了", "吃了", "已經食", "有食", "係", "是",
];

// Anything negative ("I haven't taken it", 未食, 唔好) is never treated as yes,
// so a dose is not recorded by mistake.
const NO_ENGLISH = /\b(no|not|nope|haven'?t|didn'?t|never|later|wait)\b/;
const NO_CHINESE = ["未", "冇", "唔", "沒", "不"];

function meansYes(text: string): boolean {
  if (NO_ENGLISH.test(text) || NO_CHINESE.some((word) => text.includes(word))) return false;
  return YES_WORDS.some((word) => text.includes(word));
}

// Minimal types: TypeScript does not include the Web Speech recognition API yet.
type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return recognitionConstructor() !== null;
}

// Listens once. Calls onYes if a "yes" word is heard, otherwise onNotUnderstood.
// Note: in Chrome the audio is processed by Google's speech service.
// Returns a function that stops listening.
export function startListening(
  lang: Lang,
  handlers: { onYes: () => void; onNotUnderstood: () => void; onEnd: () => void }
): () => void {
  const Ctor = recognitionConstructor();
  if (!Ctor) {
    handlers.onNotUnderstood();
    handlers.onEnd();
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = VOICE_LANG[lang];
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let answered = false;
  recognition.onresult = (event) => {
    answered = true;
    // Only use the best guess, so a negative answer can't be overridden by a worse guess.
    const bestGuess = event.results[0][0]?.transcript.toLowerCase() ?? "";
    if (meansYes(bestGuess)) handlers.onYes();
    else handlers.onNotUnderstood();
  };
  recognition.onerror = () => {
    if (!answered) handlers.onNotUnderstood();
    answered = true;
  };
  recognition.onend = () => {
    if (!answered) handlers.onNotUnderstood();
    handlers.onEnd();
  };

  recognition.start();
  return () => recognition.abort();
}
