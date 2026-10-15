# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Offline billing app (Expo SDK 57, React Native, TypeScript): business profile → saved items/rates → create bill → share as PDF. All data is local SQLite; there is no backend. Targets Indian users (₹ default, Indian digit grouping).

## Commands

Uses npm (`package-lock.json`), so use `npx`, not `bunx`. Requires Node 20.19+; the shell defaults to Node 18, so run `source ~/.nvm/nvm.sh && nvm use 22` first.

```bash
npx expo start                       # dev server; opens the development build (press s to switch to Expo Go)
npm test                             # jest (jest-expo preset), tests in __tests__/ (pure lib code + repo via node:sqlite)
npx jest __tests__/money.test.ts     # single file
npx jest -t "formatMoney"            # single test by name
npm run typecheck                    # tsc --noEmit
npm run lint                         # expo lint
npx eas-cli@latest build --profile development --platform android   # dev build (needed for voice)
npx eas-cli@latest build --profile preview --platform android       # installable APK for testing
```

`expo-speech-recognition` is a native module, so voice input only works in a development or release build. In Expo Go the app still runs: the voice sheet hides the mic and offers typing only. Changing native config (`app.json` plugins, permissions) needs a rebuild.

## Architecture

- **Routing** (`src/app/`): root `_layout.tsx` wraps everything in `SQLiteProvider` (with `useSuspense`, `onInit={migrate}`) inside a `Stack`. `(tabs)/_layout.tsx` gates the app: it redirects to `/onboarding` when no profile row exists. `bill/new.tsx` doubles as the "Duplicate" flow via `?from=<billId>`, which prefills from an existing bill.
- **Data layer**: `src/db/schema.ts` holds an append-only `MIGRATIONS` array keyed by `PRAGMA user_version`. Never edit a shipped migration; add a new entry. `src/db/repo.ts` contains all SQL as plain functions taking the `SQLiteDatabase` from `useSQLiteContext()`. Screens call repo functions directly, with no state library.
- **Profile** is a singleton row (`id = 1`). `saveProfile` upserts but deliberately never touches `next_bill_no`. `createBill` allocates the bill number, inserts the bill and its lines, and increments the counter inside `withExclusiveTransactionAsync`. It also recomputes totals rather than trusting the UI.
- **Bill lines are snapshots**: `bill_items` copies description/price, so editing or deleting a saved item never changes past bills. Bills are not editable; only create, duplicate, or delete.
- **Money**: always integer minor units (`*_minor` columns/fields, paise). Use the helpers in `src/lib/money.ts` (`parseAmount`, `formatMoney`, `lineTotal`, `computeTotals`) and never use float rupees. Quantities can be fractional. Dates are stored as local `YYYY-MM-DD` strings.
- **PDF**: `src/lib/billHtml.ts` builds a self-contained HTML string (all user text goes through `esc()`), and exports the shared `BASE_CSS`, `businessHead` and `payBlock` that the statement reuses. `src/lib/pdf.ts` renders it with `expo-print`, renames the file to `Bill-<bill_no>.pdf` via the new `expo-file-system` `File`/`Paths` API, then calls `expo-sharing`. The logo is stored as a `data:` base64 URI in `profile.logo_uri` so it can be embedded in the PDF without file access.
- **Getting paid**: `bills.status` is `'unpaid' | 'paid'` (`setBillStatus`). When `profile.upi_id` is set, unpaid bills carry a UPI QR (`src/lib/upi.ts`: `upiLink` builds the NPCI `upi://pay` link and `qrMatrix` turns it into an SVG path). `src/components/BillPaper.tsx` is the in-app bill and mirrors the PDF layout in `billHtml.ts`, so **change both together**. It always renders in light colors because it's captured with `react-native-view-shot` for "Share image". WhatsApp sending uses `https://wa.me/<phone>?text=` (`src/lib/whatsapp.ts`); deep links can't attach files, so the PDF and image go through the share sheet.
- **Trades and customers**: onboarding picks a `Trade`; `src/lib/presets.ts` defines each trade's starter items and bill prefix, seeded by `completeOnboarding` in one transaction. For quick one-off bills, `listRecentCustomers` derives customers from past bills, merges in saved clients, and `src/lib/customers.ts` filters them as the user types. A quick bill whose name and phone match a client is linked to that client (`bills.client_id`). `setNextBillNo` refuses numbers below `minNextBillNo` for the current prefix, so bill numbers never repeat.
- **Clients, work log, period bills**: `clients` hold regular customers. `entries` are work logged against a client (a trip, a visit), and stay unbilled (`bill_id IS NULL`) until `createPeriodBill` turns a date range into one bill and stamps their `bill_id` in the same transaction. Billed entries are locked (`saveEntry`/`deleteEntry` refuse them). Deleting the bill frees them via `ON DELETE SET NULL`. Period bills store `period_start/end` and a snapshot of the trade's columns in `bills.detail_fields`; each line carries `entry_date` and `details` (JSON). Statements (`src/lib/statementHtml.ts`) list a client's bills in a period with paid and outstanding totals. Period logic, including the Indian FY (Apr–Mar), is in `src/lib/period.ts`.
- **Trade drives the UI**: `presetFor(profile.trade)` gives the units (`unitsFor`) and the work-entry fields (`entryFields`, e.g. From/To/Vehicle no. for transport). The trade can be changed in Settings; existing data is never rewritten.
- **Languages**: every user-facing string goes through `src/i18n/`. `en.ts` is the source of truth and defines `TKey`. `hi.ts` is typed `Dict`, so a missing translation is a compile error. In components use `useT()` (`t`, `tn` for `_one`/`_other` counts, `unit`, `dyn` for runtime keys like `field.${key}`). Never hard-code UI text. The app language (`profile.language`) and the **bill language** (`profile.bill_language`: `en`/`hi`/`both`) are separate. Printed output (`billToHtml`, `statementToHtml`, `BillPaper`, `billMessage`) uses `makeBillTranslator(profile.bill_language)`, where `both` renders "Total / कुल". `formatDate`/`formatPeriod` take a `lang`. Repo errors meant for users throw `AppError(key)`; show them with `errorText(t, err)`.
- **Voice-to-bill**: `src/lib/voiceParse.ts` (pure, heavily tested) turns a transcript such as "2 किलो चावल 60 रुपये किलो और 1 litre milk 56" into `VoiceLine`s. It handles English, Hindi and Hinglish number words and units, splits on and/aur/और/commas, and fuzzy-matches saved items for their name, unit and rate. A spoken price is per unit unless it's marked as a total or the quantity was in grams/ml. `src/hooks/use-speech.ts` looks up the native module with `requireOptionalNativeModule`; never import `expo-speech-recognition` at runtime, because that throws in Expo Go. `VoiceBillSheet` shows the editable transcript and the parsed lines live, and nothing reaches the bill until the user confirms.
- **Backup & export**: a backup is every table dumped as JSON (`src/lib/backup.ts`: `makeBackup`/`parseBackup`, which records `schema_version`), not a copy of the SQLite file. `restoreBackup` replaces all data in one exclusive transaction, inserting only the columns the current schema has, so old backups restore with defaults and a broken file changes nothing. A backup from a newer schema is refused. **When you add a table, add it to `BACKUP_TABLES` in foreign-key order.** File I/O (share sheet, `File.pickFileAsync`) is in `src/lib/backupFiles.ts`. `profile.last_backup_at` drives the reminder on the Bills tab. CSV export (`src/lib/csv.ts`) writes a UTF-8 BOM for Excel, defuses formula cells, and uses the bill language for column headings. `__tests__/restore.test.ts` runs the real migrations and repo against Node's built-in `node:sqlite` through a small adapter that mimics expo-sqlite; use the same pattern for other repo tests.
- **Data refresh**: `useProfile()` and list screens reload in `useFocusEffect`, so returning to a screen picks up changes made elsewhere. `useProfile` returns `undefined` while loading and `null` when no profile exists.
- **UI**: shared primitives (`T`, `Card`, `Button`, `Field`, `Row`, `SectionTitle`) are in `src/components/ui.tsx`. Colors come from `useTheme()` (`src/constants/theme.ts`, light/dark). Path alias: `@/*` → `src/*`.
- `app.json` enables `typedRoutes` and `reactCompiler`.
