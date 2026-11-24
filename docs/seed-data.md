# Seed data

`npm run seed` runs [`scripts/seed.ts`](../scripts/seed.ts). It **drops the database in `MONGODB_URI` first**, then rebuilds it, so every run gives the same data.

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
  - **COMP4334 2026/27 has no assessments.** It is the target for the [Canvas import walkthrough](canvas-import.md).
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

## Large demo data

`npm run seed -- --large` adds about 600 synthetic students in four cohorts (24 classes, ~12,000 grades) for checking performance at realistic scale. Like the normal seed it drops the database it points at, so to keep your data, aim it at another database:

```bash
MONGODB_URI="mongodb://localhost:27017/su_obe_large?replicaSet=rs0&directConnection=true" npm run seed -- --large
```
