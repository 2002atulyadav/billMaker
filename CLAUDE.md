# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Offline billing app (Expo SDK 57, React Native, TypeScript): business profile → saved items/rates → create bill → share as PDF. All data is local SQLite; there is no backend. Targets Indian users (₹ default, Indian digit grouping).

## Commands

Uses npm (`package-lock.json`), so use `npx`, not `bunx`. Requires Node 20.19+.

```bash
npx expo start                       # dev server (Expo Go works; no custom native modules)
npm test                             # jest (jest-expo preset), tests in __tests__/
npx jest __tests__/money.test.ts     # single file
npx jest -t "formatMoney"            # single test by name
npm run typecheck                    # tsc --noEmit
npm run lint                         # expo lint
```

## Architecture

- **Routing** (`src/app/`): root `_layout.tsx` wraps everything in `SQLiteProvider` (with `useSuspense`, `onInit={migrate}`) inside a `Stack`. `(tabs)/_layout.tsx` gates the app: it redirects to `/onboarding` when no profile row exists. `bill/new.tsx` doubles as the "Duplicate" flow via `?from=<billId>`, which prefills from an existing bill.
- **Data layer**: `src/db/schema.ts` holds an append-only `MIGRATIONS` array keyed by `PRAGMA user_version`. Never edit a shipped migration; add a new entry. `src/db/repo.ts` contains all SQL as plain functions taking the `SQLiteDatabase` from `useSQLiteContext()`. Screens call repo functions directly, with no state library.
- **Profile** is a singleton row (`id = 1`). `saveProfile` upserts but deliberately never touches `next_bill_no`. `createBill` allocates the bill number, inserts the bill and its lines, and increments the counter inside `withExclusiveTransactionAsync`. It also recomputes totals rather than trusting the UI.
- **Bill lines are snapshots**: `bill_items` copies description/price, so editing or deleting a saved item never changes past bills. Bills are not editable; only create, duplicate, or delete.
- **Money**: always integer minor units (`*_minor` columns/fields, paise). Use the helpers in `src/lib/money.ts` (`parseAmount`, `formatMoney`, `lineTotal`, `computeTotals`) and never use float rupees. Quantities can be fractional. Dates are stored as local `YYYY-MM-DD` strings.
- **PDF**: `src/lib/billHtml.ts` builds a self-contained HTML string (all user text goes through `esc()`). `src/lib/pdf.ts` renders it with `expo-print`, renames the file to `Bill-<bill_no>.pdf` via the new `expo-file-system` `File`/`Paths` API, then calls `expo-sharing`. The logo is stored as a `data:` base64 URI in `profile.logo_uri` so it can be embedded in the PDF without file access.
- **Data refresh**: `useProfile()` and list screens reload in `useFocusEffect`, so returning to a screen picks up changes made elsewhere. `useProfile` returns `undefined` while loading and `null` when no profile exists.
- **UI**: shared primitives (`T`, `Card`, `Button`, `Field`, `Row`, `SectionTitle`) are in `src/components/ui.tsx`. Colors come from `useTheme()` (`src/constants/theme.ts`, light/dark). Path alias: `@/*` → `src/*`.
- `app.json` enables `typedRoutes` and `reactCompiler`.
