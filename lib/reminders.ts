"use client";

// Reminder helpers for the patient screen.
//
// Be realistic: a web page cannot guarantee reminders when it is closed.
// These work while the patient page is open (or the browser is running in the
// background for notifications). A real product would use a native app or
// web push. The missed-dose checker on the server keeps the records accurate anyway.

// Ask once for permission to show notifications. Call this from a tap,
// because browsers only show the permission prompt after a user action.
export function askNotificationPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  } catch {}
}

export function showNotification(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: "medimemory-dose", requireInteraction: true });
    }
  } catch {
    // Some phones only allow notifications from an installed app; the on-screen reminder still works.
  }
}

// A gentle two-note chime, made with the Web Audio API (no sound file needed).
export function playChime() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [660, 880]; // E5 then A5
    notes.forEach((frequency, i) => {
      const start = ctx.currentTime + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}
