# MediMemory (藥記通)

A medication tracker for older adults in Hong Kong, their family caregivers and their doctors.
Built as a Hack4SDG 2026 prototype.

- **Patient:** signs in on the home page with a username + PIN (or a personal link), then sees one big reminder at a time, confirmed with one large button (or by voice), read aloud in Cantonese or English. Taking the same dose twice is blocked.
- **Caregiver:** sets up medicines (manual or the simulated hospital import), sees today's doses, adherence charts, duplicate warnings and missed-dose alerts, and writes notes.
- **Doctor:** signs in by email on the home page and sees every summary shared with that email: a printable, read-only AI summary with the raw log underneath to check every statement.

> This tool records and summarises medication intake. It does not provide medical advice.
> Hospital prescription sync is **simulated for demonstration**. Use fictional data only.

## Tech

Next.js (App Router, TypeScript) · Tailwind CSS · Supabase (Postgres, Auth, Row Level Security) ·
DeepSeek API through the `openai` package (server side only) · Web Speech API · Recharts · Vercel.

## Run it on your computer

On Windows PowerShell, type `npm.cmd` instead of `npm` (PowerShell blocks `npm` by default).

1. Install [Node.js](https://nodejs.org) (LTS), then install the project's packages:
   ```bash
   npm install
   ```
2. Create a free project at [supabase.com](https://supabase.com) (region: Singapore).
3. In Supabase, open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
   (Already set up with an older version? Run [`supabase/migrations/002_usernames_and_doctor_sharing.sql`](supabase/migrations/002_usernames_and_doctor_sharing.sql) instead.)
4. In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to `http://localhost:3000` and add the Redirect URL `http://localhost:3000/**`.
5. Copy `.env.example` to `.env.local` and fill in:
   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys (Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **Publishable** key (or legacy **anon** key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **Secret** key (or legacy **service_role** key). Keep it secret. |
   | `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) → API keys |
   | `DEEPSEEK_MODEL` | `deepseek-flash` (default) |
   | `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
   | `CRON_SECRET` | optional; any long random text |
6. Check the database connection:
   ```bash
   npm run check-db
   ```
7. Start the app and open http://localhost:3000:
   ```bash
   npm run dev
   ```

## 3-minute demo

1. **Caregiver** → sign in with the email link → **Settings → Load demo data**. This loads Mrs. Chan, 78, with 4 medicines and 30 days of history, and a duplicate-aspirin warning on the Medicines tab.
2. Show the **Today** and **Adherence** tabs.
3. **Settings → Add a test dose in 1 minute**. On a phone, open the site, tap **I take medicine** and sign in as `mrschan` with the PIN shown in Settings. After a minute the reminder chimes, is read aloud and shows a notification. Tap **I took it**.
4. Sign in the same way in a second tab and tap **I took it** there too. The app says *"You already took this one at …"*.
5. Back on **Today**, the dose shows as taken (the page refreshes every 20 seconds).
6. **Doctor summary** → agree to the notice → **Generate** → review → enter a doctor's email → **Create doctor link**. The doctor taps **I am a doctor** on the home page, signs in with that email and opens the summary. Then show the chart, the sources of each medicine, the raw log, and **Print / Save as PDF**.

## Deploy to Vercel

1. Put the project on GitHub (a private repository is fine). `.env.local` is never committed.
2. At [vercel.com/new](https://vercel.com/new), import the repository. The framework is detected automatically.
3. Under **Environment Variables**, add the same variables as in `.env.local`, then click **Deploy**.
4. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel address (for example `https://medimemory.vercel.app`) and add `https://medimemory.vercel.app/**` to Redirect URLs.
5. `vercel.json` runs the missed-dose check once a day (the free plan allows daily jobs). It also runs whenever the patient screen or dashboard loads.

## How it fits together

| Path | What it is |
|---|---|
| `app/patient`, `components/patient/` | Patient check-in screen (PIN pad, dose, success, already-taken) |
| `app/caregiver`, `components/caregiver/` | Sign-in, 4-step setup wizard, dashboard tabs |
| `app/doctor/[token]` | Read-only doctor summary page |
| `app/api/patient/*` | Patient actions; the PIN is checked on the server |
| `app/api/summary` | Builds the AI summary (caregiver must be signed in) |
| `app/api/cron/sweep` | Marks unanswered doses late or missed |
| `lib/dose-rules.ts` | **All timing rules** (late after 30 min, missed after 90, snooze 10 min, max 3) |
| `lib/doses.ts` | Works out every dose and its status from the logs |
| `lib/summary.ts` | Facts computed in code, plus the strict AI prompt |
| `lib/ai.ts` | The single place that calls the AI (DeepSeek), easy to swap |
| `lib/translations.ts` | **All wording**, in English and Traditional Chinese |
| `lib/demo-data.ts` | The fictional Mrs. Chan story |
| `data/hospital-demo.json` | The simulated hospital prescription |
| `supabase/schema.sql` | Tables and Row Level Security |

## Safety, privacy and ethics

- The AI only summarises facts computed in code. It is told never to diagnose or suggest dose changes, and always to state the limits of the data.
- The AI receives no names, addresses, phone numbers or ID numbers. The caregiver agrees to a notice first and reviews every summary before sharing it.
- Doctor links are 64-character random codes that the caregiver can revoke.
- The patient never needs an email or password. The PIN is checked only on the server.
- Row Level Security means a caregiver can only reach their own patients. Anonymous visitors cannot read any table.
- **Prototype limits:** the PIN is stored as plain text and remembered in the browser, and reminders only work while the page is open. A real deployment would hash PINs, use web push or a native app, and use a locally hosted or approved AI model to meet Hong Kong's Personal Data (Privacy) Ordinance.

## Developer checks

```bash
npm run lint
```
```bash
npm run test-ai
```
`test-ai` checks the AI helper against a fake local server. It makes no real API call.
