# PLO-Canvas: OBE Gradebook & Analytics

A web app for **Outcome-Based Education (OBE)** at Sampoerna University. Lecturers enter grades by hand or import them from a Canvas gradebook CSV. Each assessment is mapped to **Program Learning Outcomes (PLOs)**, and the app shows how well students, classes and cohorts meet each PLO on spider (radar) charts.

It comes with sample data for the **Computer Science 2024 curriculum** (its 10 PLOs and the 51 courses of curriculum Table 7) and 25 made-up students.

**Contents**

1. [What you need](#1-what-you-need)
2. [Set up and run](#2-set-up-and-run)
3. [Demo logins](#3-demo-logins)
4. [Everyday commands](#4-everyday-commands)
5. [Environment variables](#5-environment-variables)
6. [Troubleshooting](#6-troubleshooting)
7. [More documentation](#7-more-documentation)

---

## 1. What you need

**To run PLO-Canvas** you only need:

| Tool | Version | Check with |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent version | `docker compose version` |
| [Git](https://git-scm.com) | any | `git --version` |

Docker runs both the app and its MongoDB 7 database, so nothing else needs installing.

**To work on the code** you also need [Node.js](https://nodejs.org) 22.12 or newer (24 recommended), which includes npm. The main packages:

| Package | What it does |
|---|---|
| Next.js 16, React 19, TypeScript | The web app framework |
| MongoDB 7 + Mongoose 9 | Database and data models |
| Tailwind CSS 4 | Styling |
| Recharts | Spider (radar) charts |
| PapaParse, exceljs | Reading Canvas CSV files, exporting to Excel |
| jose, bcryptjs | Login sessions and password hashing |
| next-intl | English and Bahasa Indonesia |
| Vitest | Tests |

The full list is in [`package.json`](package.json). For how it all fits together, see [docs/architecture.md](docs/architecture.md).

---

## 2. Set up and run

Make sure **Docker Desktop is open** before you start.

**Step 1: Download the code**

```bash
git clone https://github.com/benedictnareswara/PLO-Canvas.git
cd PLO-Canvas
```

**Step 2: Create your settings file**

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead.

Then open `.env` and replace the `JWT_SECRET` value with a long random string. On macOS or Linux this prints one:

```bash
openssl rand -base64 32
```

On Windows PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`.

**Step 3: Start PLO-Canvas**

```bash
docker compose up -d --build --wait
```

The first run builds the app and takes a few minutes. Later runs start in seconds. The app and database restart on their own when Docker Desktop starts.

**Step 4: Load the sample data** (first time only)

```bash
docker compose exec app npm run seed
```

⚠️ This **deletes everything** in the database first, then loads the sample data. To protect real data it only runs on a database named `plo_canvas…`, `…_dev` or `…_test` unless you add `-- --yes`.

Open **http://localhost:3000** and sign in with one of the [demo logins](#3-demo-logins).

**To update** after pulling new code: `git pull`, then `docker compose up -d --build --wait`. Your data stays in the database volume.

### For development

Install the packages, start only the database, and run the app with live reload:

```bash
npm install
npm run db:up
npm run seed
npm run dev
```

`npm run db:up` starts just the database container, so the dev server can use port 3000. If the Docker app is running, stop it first with `docker compose stop app`.

---

## 3. Demo logins

Every account uses the password **`Password123!`**

| Role | Email | Try this |
|---|---|---|
| Admin | `admin@sampoerna.ac.id` | Manage curricula, PLOs, courses, classes and users |
| Faculty Head | `head.cs@sampoerna.ac.id` | Cohort charts, at-risk students, course attainment |
| Lecturer | `lecturer1@sampoerna.ac.id` | Gradebook, Canvas import, class charts, advisees |
| Lecturer | `lecturer2@…`, `lecturer3@…` | Their own classes and advisees |
| Student | `student1@…` to `student25@…` | Personal spider chart and scores (compare `student6`, a senior, with `student21`, a freshman) |

These accounts are for local testing only. Remove them before deploying anywhere.

To try a Canvas import, follow [docs/canvas-import.md](docs/canvas-import.md).

---

## 4. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for development at http://localhost:3000 |
| `npm run seed` | Reset the database and load sample data |
| `npm test` | Run the tests |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Check code style |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run check` | Everything a change must pass before merging: types, lint, tests, build and `npm audit` |
| `npm run smoke` | With the app running and freshly seeded data, sign in as each role and check what each can open |
| `docker compose up -d --build --wait` | Build and start the app and database |
| `npm run db:up` | Start only the database (for `npm run dev`) |
| `docker compose stop` | Stop everything (keeps your data) |
| `docker compose down -v` | Remove the containers, the database **and all its data** |

---

## 5. Environment variables

These go in `.env` in the project folder (an older `.env.local` still works and takes precedence when you run with npm). Each person keeps their own copy; it is never committed.

| Variable | What it is | Default in `.env.example` |
|---|---|---|
| `MONGODB_URI` | Where the database is | `mongodb://localhost:27017/plo_canvas?replicaSet=rs0&directConnection=true` |
| `JWT_SECRET` | Secret used to sign login sessions. **Must be changed** to a long random string | `change-me-to-a-long-random-string` |
| `APP_URL` | The app's address. When it starts with `https://`, the sign-in cookie is marked Secure, so set it to the real HTTPS address when the app is served over HTTPS | `http://localhost:3000` |

The default `MONGODB_URI` is for `npm run dev`. The Docker app ignores it and uses the database container directly. To keep separate data sets, change only the database name (`plo_canvas`).

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` or "server selection timed out" | Docker Desktop isn't running, or the database isn't ready yet. Run `docker compose ps` and wait until it says `healthy`. |
| Port 27017 already in use | Another MongoDB is running. Stop it, or change the port in `docker-compose.yml` (e.g. `"27018:27017"`) and in `MONGODB_URI`. |
| Port 27017 is taken by `su-obe-mongo` | That container is from an older copy of this project. Stop it with `docker stop su-obe-mongo` (its data stays in its volume), then run step 3 again. |
| `JWT_SECRET is missing` (in the browser, or in `docker compose logs app`) | `.env` doesn't exist in the project folder, or still has the example value. Redo step 2, then `docker compose up -d --wait` again. |
| Port 3000 already in use | Something else (often `npm run dev`) is using it. Stop it, or change `"3000:3000"` in `docker-compose.yml` to e.g. `"3100:3000"` and open http://localhost:3100. |
| `npm run dev` stops after a Next.js upgrade notice | Run the command again. |
| Want a clean start | `docker compose down -v`, then `docker compose up -d --build --wait` and `docker compose exec app npm run seed`. |

---

## 7. More documentation

| Document | What's in it |
|---|---|
| [docs/seed-data.md](docs/seed-data.md) | Exactly what the sample data contains, and the large demo data set |
| [docs/canvas-import.md](docs/canvas-import.md) | Step-by-step Canvas CSV import test, with sample files |
| [docs/features.md](docs/features.md) | Features by role, keyboard shortcuts, and who can access what |
| [docs/obe-engine.md](docs/obe-engine.md) | The formulas for PLO attainment |
| [docs/architecture.md](docs/architecture.md) | Tech stack, folder layout, notes and limitations |
| [CHANGES.md](CHANGES.md) | Changes made for the signed proposal |
| [docs/ux-overhaul-plan.md](docs/ux-overhaul-plan.md) | The UI redesign plan and its status |
