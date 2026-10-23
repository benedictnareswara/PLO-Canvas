# OBE Gradebook & Analytics: Sampoerna University Academic Registry

This is a standalone **Outcome-Based Education (OBE)** gradebook. It takes grades from manual entry or from Canvas Gradebook CSV exports and maps each assessment to **Program Learning Outcomes (PLO / CPL)**. From there it calculates **SKS-weighted, multi-semester PLO attainment** and shows it on 10-axis spider (radar) charts for students, classes and graduation cohorts. The calculations follow the DIKTI, LAM INFOKOM and IABEE conventions.

It comes seeded with the **Sampoerna University Computer Science 2024 curriculum** (FET → CS → CS Curriculum 2024, 148 SKS, 10 PLOs).

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, route handlers, `proxy.ts`), React 19, TypeScript |
| Database | MongoDB 7 (single-node replica set via Docker Compose) + Mongoose 9 |
| Auth | Email/password (bcrypt) → signed JWT (`jose`) in an httpOnly cookie; RBAC enforced server-side |
| UI | Tailwind CSS v4, lucide icons, lightweight in-house components |
| Charts | Recharts `RadarChart` |
| CSV | PapaParse with a dedicated Canvas gradebook parser |
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
- **8 courses**, each with its PLO mapping:

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

- **13 course offerings**, from 2023/24 up to the current term (**2026/27 Odd**):
  - The **Class of 2023** (student1–3) is in semester 7.
  - The **Class of 2024** (student4–5) is in semester 5.
  - Current-term classes have only their first two assessments graded.
  - **COMP4334 2026/27 has no assessments.** It is the target for the Canvas import walkthrough below.
- **Assessments and grades**: about 4 assessments per class (quizzes, assignments, UTS, UAS, projects), with PLO weights that sum to 100% per PLO. Grades come from a deterministic PRNG applied to per-student ability profiles, so every run produces the same data, including these at-risk cases:
  - student3 is weak on PLO 1, 2 and 6.
  - student5 is weak on PLO 3, 4 and 5, which pulls the Class of 2024 cohort means for PLO 4 and 5 below 70%.
  - student2 is borderline on PLO 9.

## 3. Login credentials (development only)

Every seeded account uses the password **`Password123!`**.

| Role | Email | What to look at |
|---|---|---|
| Superadmin | `admin@sampoerna.ac.id` | Curriculum & PLOs, courses, offerings and rosters, users and Dosen Wali assignment |
| Faculty Head (also Lecturer) | `head.cs@sampoerna.ac.id` | Cohort radar (2023 vs 2024), at-risk detection with drill-down, course attainment matrix. Also teaches COMP3315 |
| Lecturer / Academic Advisor | `lecturer1@sampoerna.ac.id` | My Classes, gradebook, Canvas import, class radar, **My Advisees (5)** |
| Lecturer | `lecturer2@sampoerna.ac.id` | My Classes (no advisees) |
| Student | `student1@sampoerna.ac.id` … `student5@sampoerna.ac.id` | Personal spider chart with a semester/year filter, courses and scores |

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

Importing the same file again **updates** the existing assessments instead of duplicating them. Blank, `-` and `EX` cells never overwrite existing grades.

**Exporting from Canvas:** Course → Grades → Actions/Export → *Export Entire Gradebook*.

---

## 5. OBE calculation engine

All formulas live in [`src/lib/obe/engine.ts`](src/lib/obe/engine.ts). They are pure functions covered by unit tests in [`tests/engine.test.ts`](tests/engine.test.ts).

| # | Quantity | Formula |
|---|---|---|
| 1 | Assessment score | `ScorePct_a = Score / MaxPoints × 100` |
| 2 | Course PLO attainment | `PLO_c,k = Σ_a ScorePct_a × w_a,k`, with `Σ_a w_a,k = 100%` for each PLO k |
| 3 | Cumulative PLO (SKS-weighted) | `Σ_c (PLO_c,k × SKS_c) / Σ_c SKS_c`. Only courses that produced a value for PLO k count in the denominator |
| 4 | Cohort aggregate | `mean_i( Cumulative PLO_i,k )`, over students who have evidence for k |
| 5 | At-risk | `PLO_k < threshold` (default 70%). Course level uses the class threshold set by the lecturer; cumulative and cohort level use the curriculum target |

**Weight convention.** Lecturers enter weights per assessment, either as course-level shares (`Midterm → PLO 1: 40%`) or as a split of one assessment across PLOs (`60% PLO 4 / 40% PLO 7`). For each PLO, the engine normalizes the weights over the graded assessments mapped to it: `PLO_c,k = Σ ScorePct_a·w_a,k / Σ w_a,k`. This is exactly formula 2 whenever the weights already total 100%. The **Assessments** tab shows the resulting effective weight matrix, with each column summing to 100%. Assessments that haven't been graded yet are excluded, so in-progress courses aren't penalized.

**Semester progression.** A student's semester for an offering is `(academicYear − cohortYear) × 2 + (odd ? 1 : 2)`. The radar filters (*Cumulative*, *Year 1–4*, *Semester n*) re-run formula 3 on the matching subset.

**Materialization.** `recomputeOffering()` ([`src/lib/obe/recompute.ts`](src/lib/obe/recompute.ts)) rewrites the `courseattainments` rows (PLO_c,k per student) after any change to grades, assessments, rosters, courses or users. Dashboards then aggregate from those rows.

---

## 6. Roles and access control

Enforcement happens at three levels:
1. **Proxy** (`src/proxy.ts`): an optimistic cookie check that redirects to the user's home.
2. **Pages** (`requirePageUser`).
3. **Every API route** (`requireApiUser`, `canAccessOffering`, `canViewStudent` in [`src/lib/auth/rbac.ts`](src/lib/auth/rbac.ts)). Roles are re-read from MongoDB on each request, so role changes apply immediately.

| Capability | Superadmin | Faculty Head | Lecturer | Student |
|---|---|---|---|---|
| Faculties, departments, curricula, PLOs, courses, offerings, users, advisors | ✅ | | | |
| Department analytics, cohort radar, at-risk engine, course matrix | | ✅ (read-only, own department) | | |
| View any class in the department | | ✅ read-only | own classes | |
| Edit assessments, grades, threshold, Canvas import | ✅ (API) | own classes only | own classes | |
| My Advisees + advisee profiles | | if assigned | if assigned | |
| Own dashboard and spider chart | | | | ✅ |

---

## 7. Project structure

```
docker-compose.yml          MongoDB 7 single-node replica set
scripts/seed.ts             npm run seed
samples/                    Canvas gradebook CSV sample
src/proxy.ts                session/role routing (Next 16 "proxy", formerly middleware)
src/models/                 Mongoose models (Faculty … CourseAttainment)
src/lib/obe/                engine (formulas), semesters, aggregate, recompute, queries
src/lib/canvas/             parse.ts (pure CSV parser), import.ts (transactional upsert)
src/lib/auth/               session JWT, password hashing, RBAC guards
src/lib/admin/              generic admin resource config + data loaders
src/app/(app)/              admin/, head/, lecturer/, student/, students/[id]
src/app/api/                auth, offerings (grades, assessments, import), admin
src/components/             PloRadar, StudentProfile, offering workspace, import wizard, admin
tests/                      Vitest: engine + Canvas parser
```

## 8. Notes and limitations
- **Transactions need a replica set.** Against a standalone `mongod`, the Canvas import falls back to sequential writes and the result screen says so.
- A **null PLO value** means "no evidence yet". The radar draws it at the centre, labels it in the tooltip and caption, and never flags it as at-risk.
- The letter-grade scale (A ≥ 85 … E) is a single constant, `LETTER_SCALE` in `engine.ts`.
