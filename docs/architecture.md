# Architecture

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, route handlers, `proxy.ts`), React 19, TypeScript |
| Database | MongoDB 7 (single-node replica set via Docker Compose) + Mongoose 9 |
| Auth | Email/password (bcrypt) → signed JWT (`jose`) in an httpOnly cookie; RBAC enforced server-side |
| UI | Tailwind CSS v4 with OKLCH design tokens (light, dark, system), lucide icons, in-house components on native `<dialog>` and the Popover API |
| Tables / palette / toasts | TanStack Table, cmdk, sonner |
| Language | next-intl: English (default) and Bahasa Indonesia, chosen per user, no locale in URLs |
| Charts | Recharts `RadarChart` (lazy-loaded) |
| CSV / Excel | PapaParse with a dedicated Canvas gradebook parser; CSV export; exceljs for XLSX (loaded on demand) |
| Validation / tests | zod, Vitest |

## Project structure

```
docker-compose.yml          MongoDB 7 single-node replica set
scripts/seed.ts             npm run seed
samples/                    Canvas gradebook CSV sample
src/proxy.ts                session/role routing (Next 16 "proxy", formerly middleware)
src/models/                 Mongoose models (Faculty … CourseAttainment)
src/lib/obe/                engine (formulas), semesters, aggregate, recompute, queries
src/lib/gradebook/          score parsing, clipboard paste, grid state (pure, tested)
src/lib/audit/              audit diff, recording, history grouping
src/lib/canvas/             parse.ts (pure CSV parser), import.ts (transactional upsert)
src/lib/export/             CSV and XLSX writers
src/lib/search/             RBAC-scoped search filters
src/lib/auth/               session JWT, password hashing, RBAC guards
src/lib/admin/              generic admin resource config (with dependents) + data loaders
src/lib/hooks/              URL state, unsaved-changes guard, hotkeys, media queries
src/i18n/, messages/        next-intl config; en.json and id.json
src/app/(app)/              admin/, head/, lecturer/, student/, students/[id], loading/error/not-found
src/app/(print)/reports/    printable student, class and cohort reports
src/app/api/                auth, me, search, offerings (grades, assessments, import, history), admin
src/components/ui/          design-system primitives (dialog, menu, tabs, tooltip, data table, …)
src/components/             app shell, command palette, charts, offering workspace + gradebook, analytics, admin
tests/                      Vitest: engine, Canvas parser, gradebook, export, audit, aggregation
                            equivalence, search scope, i18n keys and usage, colour tokens and contrast
```

## Notes and limitations

- **Transactions need a replica set.** Against a standalone `mongod`, the Canvas import falls back to sequential writes and the result screen says so.
- A **null PLO value** means "no evidence yet". The radar draws it at the centre, labels it in the tooltip and caption, and never flags it as at-risk.
- The letter-grade scale (A ≥ 85 … E) is a single constant, `LETTER_SCALE` in `engine.ts`.
- **Translations.** All interface text is in `messages/en.json` and `messages/id.json`; tests fail if the two files have different keys or if code uses a key that doesn't exist. Error messages produced by the server (for example a validation message from an API route) are still in English.
- **Missing work.** Attainment counts graded assessments only (proposal §1.3, step 3), so an in-progress course isn't penalized. Once a deadline has passed, **Gradebook → Count blanks as 0** fills an assessment's blank cells with 0 as unsaved edits; saving records each one in the history.
- **Numbers are never negative.** Number fields drop a minus sign as it is typed, and the forms, API validators and Mongoose models share one set of ranges ([`src/lib/ranges.ts`](../src/lib/ranges.ts)): percentages (PLO weights, shares, targets) 0–100, max points above 0 and up to 100,000, scores 0 to 150% of max, years 1990–2100, SKS 0–24, semester 1–14, PLO numbers 1–50; a student number (NIM) is digits only.
- **Audit history** is append-only and kept indefinitely. Reseeding (`npm run seed`) clears it with everything else.
