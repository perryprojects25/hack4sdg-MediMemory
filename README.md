# MediMemory (藥記通)

**Medication tracking for older adults in Hong Kong, with AI summaries for their doctors.**

Hack4SDG 2026 · Track: Smart Living, Culture & Belonging · Team from HKUST

**Live demo:** https://hack4sdg-medi-memory.vercel.app

<!-- Add screenshots here once taken: put them in docs/images/ and use
| Patient screen | Doctor summary |
|---|---|
| ![Patient screen](docs/images/patient.png) | ![Doctor summary](docs/images/doctor-summary.png) |
-->

---

## Contents
- [The problem](#the-problem)
- [Our solution](#our-solution)
- [How it works](#how-it-works)
- [Where GenAI is used](#where-genai-is-used)
- [Key features](#key-features)
- [Try it in 2 minutes](#try-it-in-2-minutes)
- [Safety, privacy and ethics](#safety-privacy-and-ethics)
- [Tech stack](#tech-stack)
- [Future work](#future-work)
- [Team](#team)

---

## The problem

Older adults in Hong Kong often take many medicines, forget what they have already taken, and cannot tell their doctor accurately at follow-up.

- **Chronic disease is common.** 74% of older adults in Hong Kong live with a long-term chronic disease, so many manage several medicines every day. ([source](https://pubmed.ncbi.nlm.nih.gov/17664533/))
- **Many take a lot of medicines at once.** 51.5% of older patients in Hong Kong take more than 5 prescriptions, and about 1 in 3 are at risk of harmful drug interactions, which raises the risk of hospitalisation. ([source](https://pubmed.ncbi.nlm.nih.gov/40329170/))
- **Doctors decide with missing information.** Records are split across specialists and GPs, and patients, especially those with memory problems, often cannot recall what they actually took. ([source](https://www.ha.org.hk/haho/ho/psrm/E_SESUE2023.pdf))

**Who is affected:** older patients, their family caregivers, and their doctors.

## Our solution

MediMemory keeps an accurate record of every dose at home and turns it into a clear summary for the doctor, so follow-ups no longer depend on memory.

| User | What they do |
|---|---|
| **Patient** | Sees one reminder at a time, in large text in Traditional Chinese or English, and confirms with one large button. Sees today's medicines with what is already taken. Taking the same dose twice is blocked. |
| **Family caregiver** | Adds medicines, sees today's doses and adherence charts, and gets missed-dose alerts and medicine safety warnings. |
| **Doctor** | Opens a shared link to a printable AI summary, with the raw log underneath to check every statement. |

## How it works

1. **Add the medicines.** The family caregiver enters them, or imports a (simulated) hospital prescription.
2. **Tap after each dose.** The patient gets a reminder and confirms it. Late and missed doses are recorded automatically.
3. **Show the record at check-ups.** The AI turns the history into a summary the caregiver reviews and shares with the doctor.

## Where GenAI is used

All AI runs through Google's Gemini API, on the server only.

### 1. Doctor summary

**What it does.** Turns logged doses and caregiver notes into a structured summary for the doctor:
overview · adherence per medicine · patterns · possible discrepancies · caregiver observations · topics to discuss · limits of the data.

**How.** Facts such as adherence rates, missed and double doses, and common times for missed doses are calculated in code first. Gemini then writes the summary as structured JSON, using a strict prompt, a fixed response schema and a low temperature. If the AI is unavailable, a plain summary is written from the numbers instead and labelled as such.

**Why AI and not a template.** A template can show numbers. The AI links free-text caregiver notes (for example "felt dizzy on Tuesday") to the dose data and writes a summary that fits each patient's pattern.

### 2. Medicine safety check

**What it does.** Looks at the whole medicine list together and flags possible issues for the pharmacist or doctor to review: medicines that may interact, possible double-ups, doses above the usual label maximum, and medicines that need extra care at an older age.

**How.** Only medicine details and an age range are sent. Findings are kept only if they name medicines that are really on the list. The check runs by itself when the medicine list changes, and its findings also appear in the doctor summary. Simple rules in code add warnings for 5 or more daily medicines, the same dose confirmed twice, doses taken close together, and two medicines with the same ingredient.

### What the AI does not do

It does not diagnose, suggest dose changes, or tell anyone to stop or start a medicine. Every safety finding is phrased as a question for the pharmacist or doctor, and the app says the check can be wrong or miss things.

## Key features

- One-tap dose confirmation with large text and clear reminders (chime and notification)
- Today's medicines on the patient screen, with what is taken and what is next
- English and Traditional Chinese
- Double-dose protection, with a short undo for mistaken taps (the family can correct any dose)
- Late and missed-dose tracking with caregiver alerts
- Adherence charts and a 30-day history
- Medicine safety check: duplicates, possible interactions, many medicines
- AI summary for the doctor, printable and checkable against the raw log
- Doctor links that the caregiver can revoke

## Try it in 2 minutes

Sign-in is simulated in this prototype. Use fictional data only.

1. Open the [live demo](https://hack4sdg-medi-memory.vercel.app) and choose **I look after someone**.
2. Click **Try the demo →** at the top. This adds Mrs. Chan, 78, with 4 medicines and 30 days of history. (Later, **Settings → Reset demo** starts it again.)
3. Look at the **Today** and **Adherence** tabs, and the medicine safety check on **Medicines**.
4. Open the patient screen in another tab with **My medicines** and PIN **1234**. Use **Settings → Add a test dose in 1 minute** to see a reminder, tap **I took it**, then try again to see the double-dose block.
5. Open **Doctor summary → Generate**, review it, and create the doctor link.
6. Open the doctor page to see the summary, chart, safety check, raw log and **Print / Save as PDF**.

## Safety, privacy and ethics

- **Not medical advice.** The app records and summarises intake, and flags possible medicine issues for a professional to review.
- **Human review.** The caregiver reviews every summary before sharing, and the doctor can check it against the raw log.
- **Minimal data to the AI.** No names, addresses, phone numbers or ID numbers are sent, and the caregiver agrees to a notice first.
- **Access control.** Doctor links are long random codes that can be revoked. Each caregiver can only reach their own patients.
- **Respectful design.** Large text, high contrast, plain words and two languages. The app supports the patient rather than watching them. Safety warnings go to the family, not the patient screen.

**Prototype limits:** sign-in is simulated and the demo data is shared by everyone with the link, PINs are not yet hashed, reminders only work while the page is open, and hospital sync is simulated.

## Tech stack

Next.js (TypeScript) · Tailwind CSS · Supabase (Postgres) · Google Gemini API (server side only) · Recharts · Vercel

| File | Purpose |
|---|---|
| `lib/summary.ts` | Facts computed in code and the summary prompt |
| `lib/safety.ts` | Safety rules and the safety-check prompt |
| `lib/ai.ts` | The single place that calls Gemini |
| `lib/dose-rules.ts` | Timing rules (late, missed, snooze, undo) |
| `lib/translations.ts` | All wording in English and Traditional Chinese |
| `app/patient` | Patient check-in screen |
| `app/doctor/[token]` | Read-only doctor summary page |

## Future work

- Connect to the Hospital Authority and eHealth so prescriptions arrive automatically.
- Use web push or a native app so reminders work when the page is closed.
- Hash PINs, use real sign-in, and move to a locally hosted or approved AI model to meet Hong Kong's Personal Data (Privacy) Ordinance.
- Check the medicine safety findings against a licensed drug-interaction database.
- Test with older users, caregivers and doctors.

## Team

Anas Asim · Yousuf Khursheed · Danali Satybaldy · Sakief Jamil · Mustafa Ali · Team Lok To In
Hong Kong University of Science and Technology (HKUST)

---

> MediMemory records and summarises medication intake. It does not give medical advice. Hospital prescription sync is simulated for demonstration.

Developers: see [docs/SETUP.md](docs/SETUP.md) to run the project locally.
