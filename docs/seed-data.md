# Seed data

`npm run seed` runs [`scripts/seed.ts`](../scripts/seed.ts). It **drops the database in `MONGODB_URI` first**, then rebuilds it, so every run gives the same data.

- **1 Faculty** (FET), **1 Department** (Computer Science), **CS Curriculum 2024** (148 SKS, default target 70%)
- **The 10 PLOs, with the official wording of Table 3** of the curriculum document.
- **51 courses from curriculum Table 7**, with their real codes, SKS, recommended semesters and PLO mapping (48 required courses and 3 semester-8 electives). They live in [`scripts/data/cs2024.json`](../scripts/data/cs2024.json); check that file against the document when the curriculum changes. The electives are in the catalogue but have no classes.
  - The core CS courses have hand-written assessment plans that use only the PLOs Table 7 gives them:

    | Course | SKS | Sem | PLOs | Lecturer |
    |---|---|---|---|---|
    | COMP1401 Computer Programming | 4 | 2 | 1, 6 | lecturer1 |
    | COMP2424 Data Structures & Algorithms | 4 | 3 | 2, 6 | lecturer1 |
    | COMP1402 Object Oriented Programming | 4 | 4 | 1, 6 | lecturer2 |
    | COMP3408 Database Management Systems | 4 | 5 | 5 | lecturer2 |
    | COMP3311 Software Engineering | 3 | 5 | 3 | lecturer1 |
    | COMP3312 Human-Computer Interaction | 3 | 6 | 8 | lecturer2 |
    | COMP3315 Artificial Intelligence | 3 | 6 | 6 | head.cs |
    | COMP4334 Final Year Project 1 for CS | 3 | 7 | 5, 10 | lecturer1 |

    COMP1401 uses the assessments of the proposal's worked example (§1.3): Quiz 1, Assignment 1, UTS and UAS with shares 10/20/30/40%.
  - Every other course gets a generated plan: quizzes or lab reports, assignments, UTS and UAS, or project milestones for the internship and final-year projects. General-education courses are taught by lecturer2, science and engineering courses by lecturer3.

- **4 cohorts, 25 students.** Enrolment follows each course's **recommended semester**: a cohort has completed every course recommended before its current semester, is taking this semester's courses now, and hasn't taken later ones. The current term is **2026/27 Odd**.

  | Cohort | Semester now | Students | Completed | In progress |
  |---|---|---|---|---|
  | 2023 | 7 | student1–3, student6–10 | 38 courses (sem 1–6) | 6 semester-7 courses, including COMP4334 |
  | 2024 | 5 | student4–5, student11–15 | 27 courses (sem 1–4) | 5 courses, including COMP3408 and COMP3311 |
  | 2025 | 3 | student16–20 | 14 courses (sem 1–2), including COMP1401 | 7 courses, including COMP2424 |
  | 2026 | 1 | student21–25 | none | 7 general-education courses |

  - Current-term classes have only their first two assessments graded.
  - **COMP4334 2026/27 has no assessments.** It is the target for the [Canvas import walkthrough](canvas-import.md).
- **Assessments and grades**: about 4 assessments per class, with a PLO split that totals 100% per assessment. Grades come from a deterministic PRNG applied to per-student ability profiles, so every run produces the same data:
  - student3 is weak on PLO 1, 2 and 6 (and just below target on PLO 4 and 7).
  - student5 is weak on PLO 3, 4 and 5.
  - student2 is borderline on PLO 9.
  - The 20 added students (student6–25) vary more:
    - strong and weak students, and individual weak PLOs;
    - **improving or declining** students (Jasmine Halim and Nadia Permata improve; Hana Putri and Oscar Tanoto decline), so the Year and Semester filters show different shapes;
    - harder and easier courses;
    - occasional bad results;
    - **missing work**: some assessments are left blank (Kevin Siregar and Taufik Hidayat most often).

## Large demo data

`npm run seed -- --large` adds about 750 synthetic students in five cohorts for checking performance at realistic scale. Like the normal seed it drops the database it points at, so to keep your data, aim it at another database:

```bash
MONGODB_URI="mongodb://localhost:27017/plo_canvas_large?replicaSet=rs0&directConnection=true" npm run seed -- --large
```
