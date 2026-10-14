# Bill Maker

Simple offline billing app for shopkeepers, taxi drivers and freelancers: save your items and
rates, create a bill, and share it as a PDF over WhatsApp, email, or any other app.

Built with Expo SDK 57 (React Native + TypeScript). All data stays on the phone (SQLite).

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
| Saved items & rates | `src/app/(tabs)/items.tsx` |
| Business profile / settings | `src/app/(tabs)/settings.tsx` |
| Create bill (also used for "Duplicate") | `src/app/bill/new.tsx` |
| Bill detail → Share PDF / Duplicate / Delete | `src/app/bill/[id].tsx` |

- `src/db/schema.ts` – tables and versioned migrations (`PRAGMA user_version`)
- `src/db/repo.ts` – queries; `createBill` allocates the bill number inside an exclusive transaction
- `src/lib/money.ts` – money held as integer paise; Indian digit grouping
- `src/lib/billHtml.ts` + `src/lib/pdf.ts` – HTML template → `expo-print` PDF → `expo-sharing`

Bill lines are copied into the bill, so editing or deleting a saved item never changes past bills.
