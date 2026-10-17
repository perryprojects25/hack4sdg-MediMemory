// Timing rules for doses, all in one place so they are easy to change.

// Hong Kong time. Hong Kong has no daylight saving, so the offset never changes.
export const TIME_ZONE = "Asia/Hong_Kong";
export const UTC_OFFSET = "+08:00";

// "Remind me later" waits this many minutes before showing the dose again.
export const SNOOZE_MINUTES = 10;

// A dose can be snoozed at most this many times.
export const MAX_SNOOZES = 3;

// No answer after this many minutes: the dose counts as late (used in Step 5).
export const LATE_AFTER_MINUTES = 30;

// No answer after this many minutes: the dose counts as missed and is no longer shown
// to the patient (so an old dose is not taken too close to the next one).
export const MISSED_AFTER_MINUTES = 90;

// The patient can confirm a dose up to this many minutes before its time
// (for example when taking it with an early breakfast).
export const EARLY_TAKE_MINUTES = 60;

// "I pressed this by mistake" works for this many minutes after the patient
// confirmed a dose. After that only the caregiver can correct it, because
// undoing a dose that was really taken could lead to a double dose.
export const UNDO_MINUTES = 15;
