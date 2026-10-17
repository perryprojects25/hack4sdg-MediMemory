# Developer setup

How to run MediMemory on your own computer and deploy it.

On Windows PowerShell, type `npm.cmd` instead of `npm` (PowerShell blocks `npm` by default).

## Run it locally

1. Install [Node.js](https://nodejs.org) (LTS), then install the project's packages:
   ```bash
   npm install
   ```
2. Create a free project at [supabase.com](https://supabase.com) (region: Singapore).
3. In Supabase, open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](../supabase/schema.sql), and click **Run**.
   (Already set up with an older version? Run [`supabase/migrations/002_usernames_and_doctor_sharing.sql`](../supabase/migrations/002_usernames_and_doctor_sharing.sql) instead.)
4. Copy `.env.example` to `.env.local` and fill in:
   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys (Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **Publishable** key (or legacy **anon** key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **Secret** key (or legacy **service_role** key). Keep it secret. |
   | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier). Keep it secret. |
   | `GEMINI_MODEL` | optional; models tried in order, default `gemini-3-flash-preview,gemini-3.1-flash-lite` |
   | `DEMO_MODE` | `true` = no sign-in (see below) |
   | `CRON_SECRET` | optional; any long random text |
5. Check the database connection:
   ```bash
   npm run check-db
   ```
6. Start the app and open http://localhost:3000:
   ```bash
   npm run dev
   ```

## Demo mode

`DEMO_MODE=true` turns off all real sign-in:

- Everyone is the fixed **Demo Caregiver**; Mrs. Chan has a fixed id. Both are in `lib/demo-mode.ts`.
- The sign-in screens still show, but every button goes straight in. Nothing is checked, saved or sent: no emails, magic links or codes.
- The patient PIN pad accepts any 4 digits (hint: 1234) and remembers the device.
- Caregiver data goes through `/api/demo/db`, which uses the service role key on the server and only touches the demo caregiver's rows.
- The real sign-in code is still there, marked "Disabled for hackathon demo". Set `DEMO_MODE=false` to use it again. Real sign-in also needs Supabase → **Authentication → URL Configuration**: Site URL and Redirect URL (`<your address>/**`).

Anyone with the link can see and change the demo data, so use fictional data only.

## Deploy to Vercel

1. At [vercel.com/new](https://vercel.com/new), import the GitHub repository. The framework is detected automatically.
2. Under **Environment Variables**, add the same variables as in `.env.local` (mark the Supabase secret key, `GEMINI_API_KEY` and `CRON_SECRET` as secret), then click **Deploy**.
3. `DEMO_MODE` is read when the site is built, so redeploy after changing it.
4. `vercel.json` runs the missed-dose check once a day. It also runs whenever the patient screen or dashboard loads.

## How it fits together

| Path | What it is |
|---|---|
| `app/patient`, `components/patient/` | Patient screens: PIN pad, reminder, today's list, success, already taken |
| `app/caregiver`, `components/caregiver/` | Sign-in, 4-step setup wizard, dashboard tabs |
| `app/doctor/[token]` | Read-only doctor summary page |
| `app/api/patient/*` | Patient actions; the PIN is checked on the server |
| `app/api/summary` | Builds the doctor summary |
| `app/api/safety` | AI medicine safety check |
| `app/api/cron/sweep` | Marks unanswered doses late or missed |
| `lib/dose-rules.ts` | **All timing rules** (late, missed, snooze, early confirm, undo window) |
| `lib/doses.ts` | Works out every dose and its status from the logs |
| `lib/summary.ts` | Facts computed in code, plus the strict summary prompt |
| `lib/safety.ts` | Rule-based safety checks and the safety-check prompt |
| `lib/ai.ts` | The single place that calls Google Gemini |
| `lib/translations.ts` | **All wording**, in English and Traditional Chinese |
| `lib/demo-data.ts` | The fictional Mrs. Chan story |
| `data/hospital-demo.json` | The simulated hospital prescription |
| `supabase/schema.sql` | Tables and Row Level Security |

## Checks

```bash
npm run lint
```
```bash
npm run test-ai
```
`test-ai` checks the AI helper against a fake local server. It makes no real API call.
`npm run test-ai-live` makes one real call to Gemini with your key.
