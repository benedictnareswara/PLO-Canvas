# OBE Gradebook & Analytics: Sampoerna University Academic Registry

This is a standalone **Outcome-Based Education (OBE)** gradebook. It takes grades from manual entry or from Canvas Gradebook CSV exports and maps each assessment to **Program Learning Outcomes (PLO / CPL)**. From there it calculates **SKS-weighted, multi-semester PLO attainment** and shows it on 10-axis spider (radar) charts for students, classes and graduation cohorts. The calculations follow the DIKTI, LAM INFOKOM and IABEE conventions.

It comes seeded with the **Sampoerna University Computer Science 2024 curriculum** (FET → CS → CS Curriculum 2024, 148 SKS, 10 PLOs).

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

---

## 1. Quickstart

### Prerequisites
- **Node.js 22.12+ or 24 LTS** (recommended; `.nvmrc` pins 24, so `nvm use` works) and npm
- **Docker Desktop**, used to run MongoDB. Start it before running the commands below.
- **Git**

### 1) Clone and install

```bash
git clone https://github.com/benedictnareswara/PLO-Canvas.git
cd PLO-Canvas
npm install
```

### 2) Create your environment file

macOS / Linux:

```bash
cp .env.example .env.local
```

Windows (PowerShell):

```powershell
Copy-Item .env.example .env.local
```

Then open `.env.local` and replace `JWT_SECRET` with your own random value. This command prints one on any OS:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```dotenv
# .env.example
MONGODB_URI=mongodb://localhost:27017/su_obe?replicaSet=rs0&directConnection=true
JWT_SECRET=change-me-to-a-long-random-string
APP_URL=http://localhost:3000
```

`.env.local` is git-ignored. Each person keeps their own.

### 3) Start MongoDB, seed and run

```bash
docker compose up -d --wait   # MongoDB 7 on :27017; waits until replica set rs0 is healthy
npm run seed                  # drops the su_obe database and loads the CS 2024 sample data
npm run dev                   # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm test` (Vitest), `npm run lint`, `npm run typecheck`.

**Large demo data.** `npm run seed -- --large` adds about 600 synthetic students in four cohorts (24 classes, ~12,000 grades) for checking performance at realistic scale. Like the normal seed it drops the database it points at, so to keep your data, aim it at another database:

```bash
MONGODB_URI="mongodb://localhost:27017/su_obe_large?replicaSet=rs0&directConnection=true" npm run seed -- --large
```

### Troubleshooting
- **`ECONNREFUSED` / server selection timed out**: Docker Desktop isn't running, or the container isn't healthy yet. Run `docker compose ps` and wait for `healthy`.
- **Port 27017 already in use**: another MongoDB is running locally. Stop it, or change the host port in `docker-compose.yml` (e.g. `"27018:27017"`) and in `MONGODB_URI`.
- **Start the database over**: run `docker compose down -v`, then `docker compose up -d --wait` and `npm run seed`.
- **`JWT_SECRET is missing`**: `.env.local` wasn't created in the project root.

---

## 2. Database seed

`npm run seed` (`scripts/seed.ts`) is **idempotent**: it drops the database and rebuilds it with the following.

- **1 Faculty** (FET), **1 Department** (Computer Science), **CS Curriculum 2024** (148 SKS, default target 70%)
- **The 10 official CS 2024 PLOs**
- **28 courses**, each with its PLO mapping:
  - **8 core CS courses:**

    | Course | SKS | Sem | PLOs | Lecturer |
    |---|---|---|---|---|
    | COMP1401 Computer Programming | 4 | 1 | 1, 2, 3 | lecturer1 |
    | COMP1402 Object-Oriented Programming | 4 | 2 | 3, 4 | lecturer2 |
    | COMP2424 Data Structures & Algorithms | 4 | 3 | 1, 2, 6 | lecturer1 |
    | COMP3408 Database Management Systems | 4 | 5 | 4, 5, 7 | lecturer2 |
    | COMP3311 Software Engineering | 3 | 5 | 4, 7, 9, 10 | lecturer1 |
    | COMP3312 Human-Computer Interaction | 3 | 6 | 3, 8, 10 | lecturer2 |
    | COMP3315 Artificial Intelligence | 3 | 6 | 1, 6, 9 | head.cs |
    | COMP4334 Final Year Project 1 | 3 | 7 | 7, 9, 10 | lecturer1 |

  - **20 courses from the CS curriculum document (KPT 4.0, p. 37–38)**, with its credits and recommended semesters (3–8): Calculus III, General Physics II + Lab, Bahasa Indonesia, Kewarganegaraan, Differential Equations, General Psychology, Macroeconomics, US History, Basic Circuits, Microprocessor Organization + Lab, Circuit Theory, Internship, Electronic Circuits, Intro. To Communications, Computer Architecture & Design, Capstone 1, Knowledge System Engineering, Fundamentals of Information and Network Security, Computer Aided Logic Design and Capstone II. The document lists no course codes, so the seed uses placeholder codes (MATH, PHYS, GENE, ELEC, COMP). "4 / 6" and "6 – 7" use the earliest semester. Each gets a generated assessment plan: quizzes/labs, assignments, UTS and UAS, or project milestones for Internship and Capstone.

- **4 cohorts, 25 students.** Enrolment follows each course's **recommended semester**: a cohort has completed every course recommended before its current semester, is taking this semester's courses now, and hasn't taken later ones. The current term is **2026/27 Odd**.

  | Cohort | Semester now | Students | Completed | In progress |
  |---|---|---|---|---|
  | 2023 | 7 | student1–3, student6–10 | 19 courses (sem 1–6) | COMP4334, Capstone 1 and three semester-7 courses |
  | 2024 | 5 | student4–5, student11–15 | 11 courses (sem 1–4) | COMP3408, COMP3311, Basic Circuits |
  | 2025 | 3 | student16–20 | COMP1401, COMP1402 | COMP2424 and four semester-3 courses |
  | 2026 | 1 | student21–25 | none | COMP1401 |

  - Current-term classes have only their first two assessments graded.
  - **COMP4334 2026/27 has no assessments.** It is the target for the Canvas import walkthrough below.
- **Assessments and grades**: about 4 assessments per class, with a PLO split that totals 100% per assessment. Grades come from a deterministic PRNG applied to per-student ability profiles, so every run produces the same data:
  - student3 is weak on PLO 1, 2 and 6.
  - student5 is weak on PLO 3, 4 and 5.
  - student2 is borderline on PLO 9.
  - The 20 added students (student6–25) vary more:
    - strong and weak students, and individual weak PLOs;
    - **improving or declining** students (Jasmine Halim and Nadia Permata improve; Hana Putri and Oscar Tanoto decline), so the Year and Semester filters show different shapes;
    - harder and easier courses;
    - occasional bad results;
    - **missing work**: some assessments are left blank (Kevin Siregar and Taufik Hidayat most often).

## 3. Login credentials (development only)

Every seeded account uses the password **`Password123!`**.

| Role | Email | What to look at |
|---|---|---|
| Superadmin | `admin@sampoerna.ac.id` | Curriculum & PLOs, courses, offerings and rosters, users and Dosen Wali assignment |
| Faculty Head (also Lecturer) | `head.cs@sampoerna.ac.id` | Cohort radar (2023–2026, up to four at once), at-risk detection with drill-down, course attainment matrix. Also teaches COMP3315 |
| Lecturer / Academic Advisor | `lecturer1@sampoerna.ac.id` | My Classes, gradebook, Canvas import, class radar, **My Advisees** (student1–5 and some of the added students) |
| Lecturer / Academic Advisor | `lecturer2@sampoerna.ac.id`, `lecturer3@sampoerna.ac.id` | My Classes and advisees (lecturer3 teaches the maths, physics and electronics courses) |
| Student | `student1@sampoerna.ac.id` … `student25@sampoerna.ac.id` | Personal spider chart with a semester/year filter, courses and scores. Compare a senior (student6) with a freshman (student21) |

> These are seed credentials for local development. Change or remove them before deploying anywhere.

---

## 4. Testing the Canvas CSV import

A ready-made export is in **[`samples/canvas-gradebook-sample.csv`](samples/canvas-gradebook-sample.csv)**:

```csv
Student,ID,SIS User ID,SIS Login ID,Section,Project Proposal (50101),Literature Review (50102),Progress Presentation (50103),Supervisor Logbook (50104),Current Score,Unposted Current Score,Final Score,Unposted Final Score
    Points Possible,,,,,20.00,100.00,50.00,10.00,(read only),(read only),(read only),(read only)
"Wijaya, Andi",48101,2023001,student1@sampoerna.ac.id,COMP4334 Final Year Project 1 - A,18.5,88,44,9,88.6,88.6,88.6,88.6
"Lestari, Bunga",48102,2023002,student2,COMP4334 Final Year Project 1 - A,15,71,36,7,72.4,72.4,72.4,72.4
"Pratama, Citra",48103,2023003,,COMP4334 Final Year Project 1 - A,12,58,EX,6,59.2,59.2,59.2,59.2
"Nugroho, Fajar",48199,2023099,fajar.nugroho@sampoerna.ac.id,COMP4334 Final Year Project 1 - A,16,75,40,8,77.3,77.3,77.3,77.3
"Student, Test",48000,,,COMP4334 Final Year Project 1 - A,0,0,0,0,0,0,0,0
```

The sample covers every matching path:
- student1 matches by full email.
- student2 matches by a bare login, which expands to `@sampoerna.ac.id`.
- student3 has no login, so it falls back to the **SIS User ID** (NIM), and has an **EX** (excused) cell.
- One student doesn't exist in the registry.
- The Canvas **Test Student** row and the computed score columns are skipped.

### Walkthrough
1. Sign in as `lecturer1@sampoerna.ac.id`. Open **My Classes → COMP4334 · Final Year Project 1 (2026/2027 Odd)** and click **Import Canvas CSV**.
2. **Upload** the sample file. The wizard reports 4 assignment columns and 4 student rows. The "Points Possible" row supplies max points.
3. **Map to PLOs**: tick the columns to import. For each one, use the PLO dropdown and enter weights that total 100%. For example:
   - Project Proposal → PLO 7 = 60, PLO 9 = 40
   - Literature Review → PLO 9 = 100
   - Progress Presentation → PLO 10 = 100
   - Supervisor Logbook → PLO 7 = 100

   You can also set each column's share of the course grade.
4. **Review** is a server-side dry run. It shows 3 matched and enrolled students and 1 unmatched row (skipped), plus which assessments will be created or updated. Matched students who aren't enrolled can optionally be enrolled here.
5. **Confirm**. Assessments are upserted by `(offering, Canvas ID)` and grades are bulk-upserted, all in **one MongoDB transaction**. The class's PLO attainment is then recalculated: 11 grades are written and 1 excused cell is skipped.
6. Check the **Class Radar** tab, then sign in as `student1` and look at the updated cumulative spider chart (Year 4 / Semester 7 filter).

### More test files
Both files match the seeded data. Their scores are made up.

| File | Sign in as → class | What it tests |
|---|---|---|
| [`samples/canvas-COMP4334-fyp1-class-of-2023.csv`](samples/canvas-COMP4334-fyp1-class-of-2023.csv) | `lecturer1` → **COMP4334 (2026/2027 Odd)** | A full class: the 8 students of the Class of 2023 and 5 assignments. Includes an EX cell, a blank (not graded yet), a `-`, a score above max (21/20, accepted as extra credit, flagged in the dry run), 1 unmatched student and the Canvas Test Student. |
| [`samples/canvas-COMP1401-reimport-edge-cases.csv`](samples/canvas-COMP1401-reimport-edge-cases.csv) | `lecturer1` → **COMP1401 (2026/2027 Odd)**, Class of 2026 | **Re-import onto hand-made columns:** the four seeded assessments have the same titles, so they are updated, not duplicated, and the dry run lists any PLO-weight or share changes. Also covers: an **EX** cell where a grade already exists (offers *Remove these grades*); a **negative** cell (skipped, with a warning); a score **above max** (118/100); a `-` cell; a blank UAS column; a student from another cohort who isn't enrolled (offers *Enrol*); 1 unmatched row; and a new column ("Coding Challenge") to create. |

Importing the same file again **updates** the existing assessments instead of duplicating them; a column you created by hand with the same title is adopted rather than duplicated. Blank, `-` and `EX` cells never overwrite existing grades.

The dry run also lists:
- **Existing assessments whose PLO weights, share or max points the file would change**, so a re-import doesn't silently undo a faculty head's correction. Each change is recorded in the class history.
- **Scores above the max points.** Up to 150% is accepted as extra credit; anything higher stops the import.
- **EX cells for students who already have a grade here.** The grade is kept by default (NFR-03). Tick *Remove these grades* to drop them, so excused work isn't counted. Each removal is recorded as a cleared grade.

**Exporting from Canvas:** Course → Grades → Actions/Export → *Export Entire Gradebook*.

---

## 5. Features at a glance

**Gradebook (lecturers).** A spreadsheet grid on desktop and tablets, a one-assessment-at-a-time grader on phones. Both edit the same unsaved state and have the same Save bar; leaving with unsaved changes asks first. Saves send only the changed cells, each with the value it replaces: if someone else changed a cell in the meantime, nothing is written and the conflicting cells are offered as "Use theirs / Keep mine". Course grades update as you type (shown in italics until saved).

| Key | In the grid |
|---|---|
| Arrows, Home/End, Ctrl/⌘+Home/End, Page Up/Down | Move the cell cursor |
| Tab / Shift+Tab | Move along the row (leaves the grid at the edge) |
| Type a digit, Enter or F2 | Edit the cell (`85.5` and `85,5` both work) |
| Enter / Tab while editing | Save the cell and move down / right |
| Esc | Cancel the edit |
| Delete / Backspace | Clear the cell |
| Ctrl/⌘+V | Paste a block copied from Excel, Google Sheets or Numbers |
| Ctrl/⌘+Z | Undo the last edit or paste |
| Ctrl/⌘+S | Save all changes |
| Alt/⌥+H (or right-click) | History of the cell |

**Everywhere.** Ctrl/⌘+K opens the command palette: pages, recent items, and students and classes you're allowed to open. Theme (System / Light / Dark) and language (English / Bahasa Indonesia) live under the account menu → Preferences; the language is saved to your account and also offered on the sign-in page.

**Audit trail.** Every grade, assessment and target change, and every Canvas import, is recorded with old → new values, who and when, in the same database transaction as the change. Each class has a read-only **History** tab; Heads and Admins can read it but nobody can edit or revert it.

**Exports and reports.** Gradebooks, class attainment, student lists, cohort comparisons and admin lists export to CSV (UTF-8 with BOM, safe against spreadsheet formula injection) or Excel. Print-ready A4 reports (student PLO transcript, class report, cohort report) open from the class page, student profiles and the head dashboards; use the browser's **Save as PDF** for a file.

**Department analytics (Heads).** One filter bar per page, kept in the URL so a view can be shared: period, a clearly labelled what-if threshold, and cohorts to compare. Heatmapped matrices with the numbers written in, drill-downs that open under their row, and a one-PLO-at-a-time view on phones.

**Administration.** Searchable, sortable, paginated lists with export; validated forms with an error summary; deletes that first say what depends on the record; bulk Academic Advisor assignment; a setup checklist on the overview.

**Accessibility and quality.** Built to WCAG 2.2 AA: keyboard operation throughout (grid pattern for the gradebook, roving-focus tabs, menus and dialogs with focus return), visible focus never hidden behind sticky bars, at-risk states never shown by colour alone, 44 px touch targets for form fields, reduced-motion support, and contrast of every colour token checked by a test in both themes.

---

## 6. OBE calculation engine

All formulas live in [`src/lib/obe/engine.ts`](src/lib/obe/engine.ts). They are pure functions covered by unit tests in [`tests/engine.test.ts`](tests/engine.test.ts).

| # | Quantity | Formula |
|---|---|---|
| 1 | Assessment score | `ScorePct_a = Score / MaxPoints × 100` |
| 2 | Course PLO attainment | `e_a,k = share_a × PLOweight_a,k`, then `PLO_c,k = Σ_a (e_a,k × ScorePct_a) / Σ_a e_a,k` (graded assessments only) |
| 3 | Cumulative PLO (SKS-weighted) | `Σ_c (PLO_c,k × SKS_c) / Σ_c SKS_c`. Only courses that produced a value for PLO k count in the denominator |
| 4 | Cohort aggregate | `mean_i( Cumulative PLO_i,k )`, over students who have evidence for k |
| 5 | At-risk | `PLO_k < threshold` (default 70%). Course level uses the class threshold set by the lecturer; cumulative and cohort level use the curriculum target |

**Weight convention (matches the signed proposal, §1.3).** Each assessment has a *share of the course grade* (`gradeWeight`) and a *PLO split* that must total 100% (e.g. `60% PLO 4 / 40% PLO 7`; the API and the dialog both refuse anything else). The effective weight is `share × PLO weight`, and the engine averages over the **graded** assessments mapped to each PLO, so in-progress courses aren't penalized. If a course has no shares at all, every assessment counts with share 1. The **Assessments** tab shows the resulting effective weight matrix, with each column summing to 100%. Worked example (COMP1401, Andi): PLO 1 = 72.5%, PLO 6 = 75.0%, as in the proposal.

**Semester progression.** A student's semester for an offering is `(academicYear − cohortYear) × 2 + (odd ? 1 : 2)`. The radar filters (*Cumulative*, *Year 1–4*, *Semester n*) re-run formula 3 on the matching subset.

**Materialization.** `recomputeOffering()` ([`src/lib/obe/recompute.ts`](src/lib/obe/recompute.ts)) rewrites the `courseattainments` rows (PLO_c,k per student) after any change to grades, assessments, rosters, courses or users. Dashboards then aggregate from those rows.

---

## 7. Roles and access control

Enforcement happens at three levels:
1. **Proxy** (`src/proxy.ts`): an optimistic cookie check that redirects to the user's home.
2. **Pages** (`requirePageUser`).
3. **Every API route** (`requireApiUser`, `canAccessOffering`, `canViewStudent` in [`src/lib/auth/rbac.ts`](src/lib/auth/rbac.ts)). Roles are re-read from MongoDB on each request, so role changes apply immediately, and a session whose account was deactivated or deleted is ended on the next page load.

Search applies the same rules inside the database query ([`src/lib/search/scope.ts`](src/lib/search/scope.ts)), so records you can't open are never fetched. Print reports use the same checks as the matching screens.

| Capability | Superadmin | Faculty Head | Lecturer | Student |
|---|---|---|---|---|
| Faculties, departments, curricula, PLOs, courses, offerings, users, advisors | ✅ | | | |
| Department analytics, cohort radar, at-risk engine, course matrix | | ✅ (read-only, own department) | | |
| View any class in the department | | ✅ read-only | own classes | |
| Review and edit the PLO weights of a department class (FR-26, UC-08; logged, attainment recalculated) | ✅ | ✅ department classes | own classes | |
| Edit assessments, grades, threshold, Canvas import | ✅ (API) | own classes only | own classes | |
| Read a class's change history | ✅ | department classes | own classes | |
| Search (command palette) | everything | department students and classes, advisees | advisees, own classes | |
| My Advisees + advisee profiles | | if assigned | if assigned | |
| Own dashboard and spider chart | | | | ✅ |

---

## 8. Project structure

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

## 9. Notes and limitations
- **Transactions need a replica set.** Against a standalone `mongod`, the Canvas import falls back to sequential writes and the result screen says so.
- A **null PLO value** means "no evidence yet". The radar draws it at the centre, labels it in the tooltip and caption, and never flags it as at-risk.
- The letter-grade scale (A ≥ 85 … E) is a single constant, `LETTER_SCALE` in `engine.ts`.
- **Translations.** All interface text is in `messages/en.json` and `messages/id.json`; tests fail if the two files have different keys or if code uses a key that doesn't exist. Error messages produced by the server (for example a validation message from an API route) are still in English.
- **Missing work.** Attainment counts graded assessments only (proposal §1.3, step 3), so an in-progress course isn't penalized. Once a deadline has passed, **Gradebook → Count blanks as 0** fills an assessment's blank cells with 0 as unsaved edits; saving records each one in the history.
- **Numbers are never negative.** Number fields drop a minus sign as it is typed, and the forms, API validators and Mongoose models share one set of ranges ([`src/lib/ranges.ts`](src/lib/ranges.ts)): percentages (PLO weights, shares, targets) 0–100, max points above 0 and up to 100,000, scores 0 to 150% of max, years 1990–2100, SKS 0–24, semester 1–14, PLO numbers 1–50; a student number (NIM) is digits only.
- **Audit history** is append-only and kept indefinitely. Reseeding (`npm run seed`) clears it with everything else.
