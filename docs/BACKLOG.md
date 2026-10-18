# Dhanzo backlog

Everything planned or pending, in priority order. Update this file when something ships or a new idea is agreed.
The detailed designs live in the PR or commit that implements each item.

## Now / blocking
- [ ] **Check on a real iPhone and Android phone (Expo Go):**
  - date picker (new bill, work entry, payment);
  - Share PDF and Share image, including Hindi text in the PDF;
  - Send on WhatsApp and Send payment reminder;
  - scan the UPI QR with GPay or PhonePe (right amount, including a part-paid balance);
  - client screen "Edit" button margin;
  - backup → delete → restore, and open the exported CSV;
  - app lock (cold start; no re-lock after a quick share);
  - bill themes: share the PDF and image in each theme.
- [ ] **A native Hindi speaker reviews** `src/i18n/hi.ts`.

## Release prep (v1)
- [ ] Buy **dhanzo.app**, search the IP India trademark registry for "Dhanzo" (classes 9 and 36), and file once it's clear.
- [x] Rename to Dhanzo (`app.dhanzo`); old backups still restore.
- [ ] **Test APK:**
  - `npx eas-cli@latest login`, then `init`, then `build --platform android --profile preview`;
  - share the link and `docs/TESTING.md` with 10–20 testers across trades for 1–2 weeks.
- [ ] Store listing in English and Hindi: screenshots, short and long description, feature graphic (`assets/brand/`).
- [ ] Privacy policy: drafted in `docs/PRIVACY.md`. Add the support email and host it at a public URL (Play needs one).
- [ ] EAS: preview APK → production build → Play internal testing → App Store TestFlight.
- [ ] Shopkeeper recall test of the name and tagline with 5–10 real users.
- [ ] Decide: should bills made before payment tracking default to unpaid? (They do today.)

## v1.1
- [ ] **Payment confirmation:**
  - "Paste bank SMS": a parser reads the amount, UTR, payer and date, and suggests the matching unpaid bill (works on iOS and Android, no SMS permission);
  - duplicate-UTR guard;
  - print "Payment note: TR-0001" on bills;
  - the tip "confirm in your bank SMS/app, not the customer's screenshot".
- [ ] **Sales dashboard / reports:** billed, collected and pending for today and this month; top customers; simple charts.
- [ ] **Quotation → bill:** send an estimate, then turn it into a bill in one tap.

## v1.2+
- [ ] Optional GST: GSTIN, tax % per item, CGST/SGST/IGST, HSN/SAC.
- [ ] Thermal printer (58/80 mm Bluetooth, dev build). The Receipt theme is the starting layout.
- [ ] Recurring bills (monthly tutor fees, vehicle hire).
- [ ] Android: detect payments automatically from UPI/bank app notifications (notification listener, Play declaration).
- [ ] Optional payment gateway, "Dhanzo Pay": dynamic QR + webhook. Needs a backend, KYC and fees.
- [ ] Edit a bill (today: duplicate or delete only).
- [ ] Automatic Google Drive backup.

## Going global (later)
- **B. Groundwork** (driven by a country setting):
  - currency and decimals (JPY/VND have none), number grouping, date format;
  - financial year by country, phone country code;
  - payment-QR abstraction, plus "upload your own QR" where it can't be generated;
  - per-language voice packs and PDF fonts.
- **C. Indian languages:** Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Odia.
- **D. Southeast Asia:**
  - Indonesia, Malaysia, Thailand, Vietnam, Philippines;
  - local QR codes (PromptPay, DuitNow, VietQR, QR Ph, PayNow);
  - tax labels; Thai and Vietnamese fonts.
- **E. South Asia:** Nepal, Sri Lanka, Bangladesh, Pakistan. Urdu reads right to left, so it needs a mirrored layout.
- **F. East and West Asia:** Japanese, Korean, Chinese, Arabic, Persian, Turkish. Some of these countries have e-invoicing rules.

## Housekeeping
- [ ] Delete the merged feature branches on GitHub.
- [ ] `gh auth login` so pull requests can be opened from the terminal.
- [ ] Merge `dev` into `main` at the first release.
- [ ] Move the brand source files (`Dhanzo Brand Identity Showcase.png`, `dhanzo-logo-tagline.svg`) into `assets/brand/source/` and commit them.
- **Expo Go limits to remember:** Face ID and voice input only work in a development or release build.

## Done (for reference)
Bills, items, PDF; get paid (UPI QR, WhatsApp, image share); trade setups; clients, work log, period bills and statements; Hindi and bilingual bills; voice-to-bill; backup, restore and CSV; layouts for every screen size; Dhanzo brand and icons; part payments, due dates, overdue and reminders; app lock; bill themes.
