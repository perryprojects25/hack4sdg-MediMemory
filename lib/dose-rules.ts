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
