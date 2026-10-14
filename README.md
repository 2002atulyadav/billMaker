# Bill Maker

Simple offline billing app for shopkeepers, taxi drivers and freelancers: save your items and
rates, create a bill, and share it as a PDF over WhatsApp, email, or any other app.

Built with Expo SDK 57 (React Native + TypeScript). All data stays on the phone (SQLite).
Available in English and Hindi. Bills can be printed in English, Hindi or both.

## Run it

Requires Node 20.19+ (`nvm use 22`).

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

```bash
npm test            # unit tests (money math, bill HTML)
npm run typecheck
npm run lint
```

## How it works

| Screen | File |
|---|---|
| First-launch business setup | `src/app/onboarding.tsx` |
| Bills history + search | `src/app/(tabs)/index.tsx` |
| Clients (regular customers, unbilled work) | `src/app/(tabs)/clients.tsx` |
| Client work log → monthly/yearly bill, statement | `src/app/client/[id].tsx` |
| Saved items & rates | `src/app/(tabs)/items.tsx` |
| Business profile / settings | `src/app/(tabs)/settings.tsx` |
| Create bill (also used for "Duplicate") | `src/app/bill/new.tsx` |
| Bill detail → Share PDF / Duplicate / Delete | `src/app/bill/[id].tsx` |

- `src/db/schema.ts` – tables and versioned migrations (`PRAGMA user_version`)
- `src/db/repo.ts` – queries; `createBill` allocates the bill number inside an exclusive transaction
- `src/lib/money.ts` – money held as integer paise; Indian digit grouping
- `src/lib/billHtml.ts` + `src/lib/pdf.ts` – HTML template → `expo-print` PDF → `expo-sharing`

Bill lines are copied into the bill, so editing or deleting a saved item never changes past bills.

For regular clients (e.g. a transport company billing a business monthly), log each trip or job as a
work entry on the client, then create one bill for a month, year, Indian FY or custom range. Each entry
becomes a dated line with the trade's columns (From / To / Vehicle no. for transport). A statement of
account lists every bill sent to the client in a period with paid and outstanding totals.
