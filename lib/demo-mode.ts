// HACKATHON DEMO MODE: one switch, DEMO_MODE=true in .env.local.
// When it is on, nobody signs in. Every page acts as the fixed demo caregiver below,
// and all caregiver data goes through server routes that use the service role key
// (see lib/demo-server.ts). No sign-in emails, magic links or codes are ever sent.
// The real sign-in code is still in the app, switched off ("Disabled for hackathon demo").

// next.config.ts copies DEMO_MODE into NEXT_PUBLIC_DEMO_MODE so the browser can read it too.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// Fixed demo users. Fictional.
export const DEMO_CAREGIVER = {
  id: "00000000-0000-4000-8000-00000000c0de",
  name: "Demo Caregiver",
  // Reserved example domain: never a real inbox, and nothing is ever sent to it.
  email: "demo-caregiver@example.com",
};

// Mrs. Chan, created by "Load demo data" with this id.
export const DEMO_PATIENT_ID = "00000000-0000-4000-8000-0000000c4a17";

// Shown on the patient PIN screen. In demo mode any 4 digits are accepted.
export const DEMO_PIN = "1234";
