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

Install these first:

| Tool | Version | Used for | Check with |
|---|---|---|---|
| [Node.js](https://nodejs.org) | 22.12 or newer (24 recommended) | Running the app | `node -v` |
| npm | comes with Node.js | Installing packages | `npm -v` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent version | Running the MongoDB 7 database | `docker compose version` |
| [Git](https://git-scm.com) | any | Downloading the code | `git --version` |

You don't need to install MongoDB yourself. Docker runs it for you.

The npm packages are installed automatically in step 2. The main ones:

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

**Step 1: Download the code and install packages**

```bash
git clone https://github.com/benedictnareswara/PLO-Canvas.git
cd PLO-Canvas
npm install
```

**Step 2: Create your settings file**

```bash
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead.

Then open `.env.local` and replace the `JWT_SECRET` value with a random string. This prints one for you:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Step 3: Start the database**

```bash
docker compose up -d --wait
```

This starts MongoDB on port 27017 and waits until it's ready.

**Step 4: Load the sample data**

```bash
npm run seed
```

⚠️ This **deletes everything** in the database first, then loads the sample data.

**Step 5: Start the app**

```bash
npm run dev
```

Open **http://localhost:3000** and sign in with one of the [demo logins](#3-demo-logins).

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
| `docker compose up -d --wait` | Start the database |
| `docker compose stop` | Stop the database (keeps your data) |
| `docker compose down -v` | Remove the database **and all its data** |

---

## 5. Environment variables

These go in `.env.local` in the project folder. Each person keeps their own copy; it is never committed.

| Variable | What it is | Default in `.env.example` |
|---|---|---|
| `MONGODB_URI` | Where the database is | `mongodb://localhost:27017/su_obe?replicaSet=rs0&directConnection=true` |
| `JWT_SECRET` | Secret used to sign login sessions. **Must be changed** to a long random string | `change-me-to-a-long-random-string` |
| `APP_URL` | The app's address | `http://localhost:3000` |

The default `MONGODB_URI` works with the database from step 3. To keep separate data sets, change only the database name (`su_obe`).

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` or "server selection timed out" | Docker Desktop isn't running, or the database isn't ready yet. Run `docker compose ps` and wait until it says `healthy`. |
| Port 27017 already in use | Another MongoDB is running. Stop it, or change the port in `docker-compose.yml` (e.g. `"27018:27017"`) and in `MONGODB_URI`. |
| Container name `su-obe-mongo` already in use | An older copy of this project created it. Run `docker start su-obe-mongo` to reuse it, or remove it with `docker rm su-obe-mongo`. |
| `JWT_SECRET is missing` | `.env.local` doesn't exist in the project folder. Redo step 2. |
| `npm run dev` stops after a Next.js upgrade notice | Run the command again. |
| Want a clean start | `docker compose down -v`, then `docker compose up -d --wait` and `npm run seed`. |

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
