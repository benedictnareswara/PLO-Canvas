/**
 * Seeds MongoDB with the Sampoerna University CS 2024 curriculum, users,
 * offerings, assessments and deterministic grades.
 *
 *   npm run seed            (drops the database first, then repopulates)
 *   npm run seed -- --large (adds ~750 synthetic students in five cohorts, for performance checks)
 *
 * Enrolment follows each course's recommended semester: a cohort has completed every course
 * recommended before its current semester, is taking this semester's courses now (only the first
 * assessments graded), and has not taken later ones.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import mongoose from "mongoose";
import { hashPassword } from "../src/lib/auth/password";
import { recomputeOffering } from "../src/lib/obe/recompute";
import {
  Assessment,
  Course,
  CourseOffering,
  Curriculum,
  Department,
  Enrollment,
  Faculty,
  Grade,
  Plo,
  User,
  type Term,
} from "../src/models";

const SEED_PASSWORD = "Password123!";
const CURRENT = { academicYear: 2026, term: "odd" as Term }; // 2026/2027 odd semester is in progress

const PLOS: [string, string][] = [
  ["Algorithms & Applied Mathematics", "Algorithms & applied mathematics to innovate and solve complex problems"],
  ["Systems & Problem Solving", "Computer system operations & algorithmic problem solving for organizations"],
  ["Multi-platform Application Design", "Theoretical and practical computing to design/simulate multi-platform applications"],
  ["Computing Solutions Engineering", "Designing, implementing, and evaluating computing-based solutions"],
  ["Organizational Computing", "Multi-platform computing solutions aligned with organizational needs"],
  ["Advanced Algorithms (SD, AI, IoT)", "Advanced algorithms (Software Dev, AI, Digital Peripherals & IoT)"],
  ["Problem Analysis & IT Project Mgmt", "Analyzing complex computing problems & IT project management"],
  ["UI/UX & Usability", "User interface (UI/UX) design, interactive applications, and usability"],
  ["Professional Ethics & Lifelong Learning", "Professional responsibility, ethics, legal standards, and lifelong learning"],
  ["Leadership & Communication", "Leadership, teamwork, effective communication, and task management"],
];

type Template = { title: string; max: number; gradeWeight: number; plos: Record<number, number> };

// Relative PLO emphasis per assessment. At seed time each assessment's weights are scaled to a
// split that totals 100% (proposal FR-08); the engine then multiplies by the assessment's grade share.
function splitTo100(plos: Record<number, number>): { plo: number; weight: number }[] {
  const entries = Object.entries(plos).map(([n, w]) => [Number(n), w] as const);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  const out = entries.map(([plo, w]) => ({ plo, weight: Math.round((w / total) * 10000) / 100 }));
  const drift = Math.round((100 - out.reduce((s, w) => s + w.weight, 0)) * 100) / 100;
  out[0].weight = Math.round((out[0].weight + drift) * 100) / 100;
  return out;
}
const COURSES: {
  code: string;
  title: string;
  sks: number;
  semester: number;
  plos: number[];
  lecturer: string;
  assessments: Template[];
  /** Added to every expected score in this course (curriculum courses only; 0 when omitted). */
  difficulty?: number;
}[] = [
  {
    code: "COMP1401", title: "Computer Programming", sks: 4, semester: 1, plos: [1, 2, 3], lecturer: "lecturer1",
    assessments: [
      { title: "Lab Exercises", max: 100, gradeWeight: 20, plos: { 1: 20, 2: 30, 3: 20 } },
      { title: "Programming Assignment", max: 100, gradeWeight: 20, plos: { 2: 30, 3: 40 } },
      { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 30, plos: { 1: 40, 2: 20 } },
      { title: "Final Exam (UAS)", max: 100, gradeWeight: 30, plos: { 1: 40, 2: 20, 3: 40 } },
    ],
  },
  {
    code: "COMP1402", title: "Object-Oriented Programming", sks: 4, semester: 2, plos: [3, 4], lecturer: "lecturer2",
    assessments: [
      { title: "Lab Quizzes", max: 50, gradeWeight: 15, plos: { 3: 30 } },
      { title: "OOP Design Assignment", max: 100, gradeWeight: 25, plos: { 3: 30, 4: 40 } },
      { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 30, plos: { 3: 40, 4: 20 } },
      { title: "Final Project", max: 100, gradeWeight: 30, plos: { 4: 40 } },
    ],
  },
  {
    code: "COMP2424", title: "Data Structures & Algorithms", sks: 4, semester: 3, plos: [1, 2, 6], lecturer: "lecturer1",
    assessments: [
      { title: "Problem Sets", max: 60, gradeWeight: 20, plos: { 1: 30, 2: 30 } },
      { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 30, plos: { 1: 40, 2: 30, 6: 20 } },
      { title: "Algorithm Implementation Project", max: 100, gradeWeight: 20, plos: { 2: 40, 6: 40 } },
      { title: "Final Exam (UAS)", max: 100, gradeWeight: 30, plos: { 1: 30, 6: 40 } },
    ],
  },
  {
    code: "COMP3408", title: "Database Management Systems", sks: 4, semester: 5, plos: [4, 5, 7], lecturer: "lecturer2",
    assessments: [
      { title: "ER Modelling Assignment", max: 50, gradeWeight: 20, plos: { 4: 40, 5: 20 } },
      { title: "SQL Lab Test", max: 100, gradeWeight: 20, plos: { 4: 30, 5: 30 } },
      { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 25, plos: { 4: 30, 7: 30 } },
      { title: "Database Project", max: 100, gradeWeight: 35, plos: { 5: 50, 7: 70 } },
    ],
  },
  {
    code: "COMP3311", title: "Software Engineering", sks: 3, semester: 5, plos: [4, 7, 9, 10], lecturer: "lecturer1",
    assessments: [
      { title: "Requirements Specification", max: 100, gradeWeight: 20, plos: { 4: 30, 7: 30 } },
      { title: "Software Ethics Essay", max: 20, gradeWeight: 10, plos: { 9: 60 } },
      { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 25, plos: { 4: 40, 7: 30, 9: 40 } },
      { title: "Team Project Delivery", max: 100, gradeWeight: 45, plos: { 4: 30, 7: 40, 10: 100 } },
    ],
  },
  {
    code: "COMP3312", title: "Human-Computer Interaction", sks: 3, semester: 6, plos: [3, 8, 10], lecturer: "lecturer2",
    assessments: [
      { title: "Usability Evaluation Report", max: 100, gradeWeight: 25, plos: { 8: 40 } },
      { title: "Interactive Prototype", max: 100, gradeWeight: 25, plos: { 3: 50, 8: 30 } },
      { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 20, plos: { 3: 50, 8: 30 } },
      { title: "Group Design Studio", max: 100, gradeWeight: 30, plos: { 10: 100 } },
    ],
  },
  {
    code: "COMP3315", title: "Artificial Intelligence", sks: 3, semester: 6, plos: [1, 6, 9], lecturer: "head.cs",
    assessments: [
      { title: "Search & Logic Problem Set", max: 50, gradeWeight: 20, plos: { 1: 50, 6: 20 } },
      { title: "Machine Learning Mini Project", max: 100, gradeWeight: 30, plos: { 6: 50 } },
      { title: "AI Ethics Case Study", max: 100, gradeWeight: 15, plos: { 9: 100 } },
      { title: "Final Exam (UAS)", max: 100, gradeWeight: 35, plos: { 1: 50, 6: 30 } },
    ],
  },
  // Left without assessments: populated via the Canvas CSV import walkthrough.
  { code: "COMP4334", title: "Final Year Project 1", sks: 3, semester: 7, plos: [7, 9, 10], lecturer: "lecturer1", assessments: [] },
  ...curriculumCourses(),
];

/**
 * Assessment plan for a course from the curriculum document: exams for lecture courses, lab work
 * for "+ Lab" courses, milestones for projects. PLO emphasis varies per assessment so the course's
 * PLOs aren't all measured identically.
 */
function generatedAssessments(kind: "lecture" | "lab" | "project", plos: number[]): Template[] {
  const all = Object.fromEntries(plos.map((n, i) => [n, 3 + (i % 3)]));
  const first = { [plos[0]]: 1 };
  const firstTwo = Object.fromEntries(plos.slice(0, 2).map((n) => [n, 1]));
  const rest = plos.length > 1 ? Object.fromEntries(plos.slice(1).map((n) => [n, 1])) : first;
  if (kind === "project") {
    return [
      { title: "Project Proposal", max: 20, gradeWeight: 20, plos: firstTwo },
      { title: "Progress Report", max: 100, gradeWeight: 30, plos: all },
      { title: "Final Presentation", max: 50, gradeWeight: 20, plos: rest },
      { title: "Supervisor Evaluation", max: 100, gradeWeight: 30, plos: all },
    ];
  }
  return [
    kind === "lab"
      ? { title: "Lab Reports", max: 100, gradeWeight: 25, plos: rest }
      : { title: "Weekly Quizzes", max: 20, gradeWeight: 15, plos: first },
    { title: "Assignments", max: 100, gradeWeight: kind === "lab" ? 15 : 25, plos: all },
    { title: "Midterm Exam (UTS)", max: 100, gradeWeight: 30, plos: firstTwo },
    { title: "Final Exam (UAS)", max: 100, gradeWeight: 30, plos: all },
  ];
}

/**
 * The courses of the Computer Science curriculum document (KPT 4.0, p. 37–38) with their credits
 * and recommended semesters. The document lists no course codes, so these codes are placeholders.
 * "4 / 6" and "6 – 7" use the earliest semester.
 */
function curriculumCourses(): typeof COURSES {
  const rows: [string, string, number, number, number[], "lecture" | "lab" | "project", string][] = [
    ["MATH2301", "Calculus III", 3, 3, [1], "lecture", "lecturer3"],
    ["PHYS2302", "General Physics II + Lab", 4, 3, [1, 2], "lab", "lecturer3"],
    ["GENE2303", "Bahasa Indonesia", 2, 3, [10, 9], "lecture", "lecturer2"],
    ["GENE2304", "Kewarganegaraan", 3, 3, [9, 10], "lecture", "lecturer2"],
    ["MATH2405", "Differential Equations", 3, 4, [1, 2], "lecture", "lecturer3"],
    ["GENE2406", "General Psychology", 3, 4, [10, 9], "lecture", "lecturer2"],
    ["GENE2407", "Macroeconomics", 3, 4, [5, 9], "lecture", "lecturer2"],
    ["GENE2408", "US History", 3, 4, [9, 10], "lecture", "lecturer2"],
    ["ELEC3509", "Basic Circuits", 5, 5, [1, 2], "lab", "lecturer3"],
    ["ELEC3610", "Microprocessor Organization + Lab", 4, 6, [2, 6], "lab", "lecturer3"],
    ["ELEC3611", "Circuit Theory", 3, 6, [1, 2], "lecture", "lecturer3"],
    ["COMP3612", "Internship", 3, 6, [7, 9, 10], "project", "head.cs"],
    ["ELEC4713", "Electronic Circuits", 4, 7, [2, 6], "lab", "lecturer3"],
    ["ELEC4714", "Intro. To Communications", 3, 7, [2, 5], "lecture", "lecturer3"],
    ["COMP4715", "Computer Architecture & Design", 3, 7, [2, 6], "lecture", "lecturer1"],
    ["COMP4716", "Capstone 1", 3, 7, [4, 7, 10], "project", "head.cs"],
    ["COMP4817", "Knowledge System Engineering", 3, 8, [6, 7], "lecture", "head.cs"],
    ["COMP4818", "Fundamentals of Information and Network Security", 3, 8, [5, 9], "lecture", "lecturer1"],
    ["ELEC4819", "Computer Aided Logic Design", 3, 8, [2, 6], "lab", "lecturer3"],
    ["COMP4820", "Capstone II", 3, 8, [4, 7, 10], "project", "head.cs"],
  ];
  return rows.map(([code, title, sks, semester, plos, kind, lecturer]) => ({
    code, title, sks, semester, plos, lecturer, assessments: generatedAssessments(kind, plos), difficulty: difficultyOf(code),
  }));
}

/** A fixed per-course difficulty (-6 … +3 points), so some courses are visibly harder. */
function difficultyOf(code: string): number {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 10) - 6;
}

/**
 * Ability profiles (expected %), with per-PLO adjustments to create realistic at-risk cases.
 * `trend`: points gained (or lost) per semester, so Year 1 and Year 3 look different.
 * `missing`: share of assessments never handed in (left blank, so not counted).
 */
type Profile = {
  key: string;
  name: string;
  nim: string;
  cohort: number;
  base: number;
  adj: Record<number, number>;
  trend?: number;
  missing?: number;
  /** Extra students draw from their own random stream, so the original five keep their grades. */
  extra?: boolean;
};

const STUDENTS: Profile[] = [
  { key: "student1", name: "Andi Wijaya", nim: "2023001", cohort: 2023, base: 87, adj: {} },
  { key: "student2", name: "Bunga Lestari", nim: "2023002", cohort: 2023, base: 79, adj: { 9: -12 } },
  { key: "student3", name: "Citra Pratama", nim: "2023003", cohort: 2023, base: 73, adj: { 1: -18, 2: -15, 6: -17 } },
  { key: "student4", name: "Dimas Saputra", nim: "2024001", cohort: 2024, base: 83, adj: { 5: -4 } },
  { key: "student5", name: "Eka Kurniawan", nim: "2024002", cohort: 2024, base: 77, adj: { 3: -28, 4: -32, 5: -12 } },
];

/** 20 more students, five per cohort 2023–2026: strong, weak, improving, declining, absent. */
const EXTRA_STUDENTS: Profile[] = (
  [
    // Class of 2023: semester 7
    ["Gilang Ramadhan", 2023, 91, {}, 0.4, 0],
    ["Hana Putri", 2023, 70, { 7: -10, 10: -8 }, -1.6, 0],
    ["Irfan Hakim", 2023, 80, { 8: 6 }, 0, 0.02],
    ["Jasmine Halim", 2023, 60, { 1: -8 }, 2.4, 0],
    ["Kevin Siregar", 2023, 76, {}, 0, 0.12],
    // Class of 2024: semester 5
    ["Laras Utami", 2024, 88, { 9: 4 }, 0.5, 0],
    ["Maulana Yusuf", 2024, 64, { 3: -12, 4: -10 }, 0, 0.05],
    ["Nadia Permata", 2024, 72, {}, 2.2, 0],
    ["Oscar Tanoto", 2024, 82, { 6: -6 }, -2.0, 0],
    ["Putu Ayu", 2024, 84, { 1: 5, 2: -11 }, 0, 0.03],
    // Class of 2025: semester 3
    ["Qori Amalia", 2025, 90, {}, 0.6, 0],
    ["Reza Pahlevi", 2025, 61, { 2: -12 }, 1.5, 0.04],
    ["Salsa Anindita", 2025, 77, { 10: 8 }, 0, 0],
    ["Taufik Hidayat", 2025, 69, { 1: -6 }, -1.2, 0.15],
    ["Umi Kalsum", 2025, 82, { 9: 6, 10: 6, 3: -9 }, 0, 0],
    // Class of 2026: semester 1 (first term in progress)
    ["Valentino Hartono", 2026, 86, {}, 0, 0],
    ["Wulan Sari", 2026, 73, { 3: -8 }, 0, 0],
    ["Xavier Wibisono", 2026, 64, { 1: -12 }, 0, 0.1],
    ["Yasmin Aulia", 2026, 93, {}, 0, 0],
    ["Zaki Firmansyah", 2026, 57, { 2: -10 }, 0, 0.05],
  ] as const
).map(([name, cohort, base, adj, trend, missing], i, all) => {
  const before = all.slice(0, i).filter((r) => r[1] === cohort).length;
  const taken = STUDENTS.filter((s) => s.cohort === cohort).length;
  return {
    key: `student${STUDENTS.length + i + 1}`,
    name,
    nim: `${cohort}${String(taken + before + 1).padStart(3, "0")}`,
    cohort,
    base,
    adj: adj as Record<number, number>,
    trend,
    missing,
    extra: true,
  };
});

const LARGE = process.argv.includes("--large");
const COHORTS = LARGE ? [2022, 2023, 2024, 2025, 2026] : [2023, 2024, 2025, 2026];
const LARGE_PER_COHORT = 150;

/* Deterministic PRNG so every seed run produces identical data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20241);
const gaussian = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
// Separate stream for the extra students, so the original five keep exactly the same grades.
const rand2 = mulberry32(90210);
const gaussian2 = () => Math.sqrt(-2 * Math.log(1 - rand2())) * Math.cos(2 * Math.PI * rand2());

/**
 * Synthetic students for --large: ability between ~58% and ~94%, with one or two weak PLOs for a
 * third of them, so dashboards show realistic at-risk spreads. A separate PRNG keeps the default
 * seed's data unchanged.
 */
const FIRST = ["Adi", "Bayu", "Citra", "Dewi", "Eko", "Fajar", "Gita", "Hadi", "Indah", "Joko", "Kartika", "Lina", "Made", "Nanda", "Oki", "Putri", "Rizki", "Sari", "Teguh", "Wulan", "Yoga", "Zahra"];
const LAST = ["Wijaya", "Lestari", "Pratama", "Saputra", "Kurniawan", "Santoso", "Hidayat", "Nugroho", "Siregar", "Halim", "Gunawan", "Permata", "Utami", "Setiawan", "Rahman", "Putra"];
function largeStudents(): Profile[] {
  const r = mulberry32(7331);
  return COHORTS.flatMap((cohort) =>
    Array.from({ length: LARGE_PER_COHORT }, (_, i) => {
      const adj: Record<number, number> = {};
      if (r() < 0.33) adj[1 + Math.floor(r() * 10)] = -(10 + Math.round(r() * 20));
      if (r() < 0.15) adj[1 + Math.floor(r() * 10)] = -(10 + Math.round(r() * 20));
      return {
        key: `s${cohort}-${String(i + 1).padStart(3, "0")}`,
        name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
        nim: `${cohort}${String(100 + i).padStart(3, "0")}`,
        cohort,
        base: 58 + Math.round(r() * 36),
        adj,
      };
    }),
  );
}

function semesterToPeriod(cohort: number, semester: number) {
  return { academicYear: cohort + Math.floor((semester - 1) / 2), term: (semester % 2 === 1 ? "odd" : "even") as Term };
}
const isFuture = (p: { academicYear: number; term: Term }) =>
  p.academicYear > CURRENT.academicYear ||
  (p.academicYear === CURRENT.academicYear && p.term === "even" && CURRENT.term === "odd");
const isCurrent = (p: { academicYear: number; term: Term }) =>
  p.academicYear === CURRENT.academicYear && p.term === CURRENT.term;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`Connected to ${mongoose.connection.name}. Dropping existing data…`);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  const faculty = await Faculty.create({ code: "FET", name: "Faculty of Engineering and Technology" });
  const department = await Department.create({ code: "CS", name: "Computer Science", faculty: faculty._id });
  const curriculum = await Curriculum.create({
    name: "CS Curriculum 2024",
    year: 2024,
    totalSks: 148,
    department: department._id,
    defaultThreshold: 70,
  });
  const plos = await Plo.insertMany(
    PLOS.map(([shortLabel, description], i) => ({
      curriculum: curriculum._id,
      number: i + 1,
      code: `PLO ${i + 1}`,
      shortLabel,
      description,
    })),
  );
  const ploId = (n: number) => plos[n - 1]._id;

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const dept = department._id;
  const staff = {
    admin: await User.create({ email: "admin@sampoerna.ac.id", name: "Registry Superadmin", roles: ["superadmin"], passwordHash, staffId: "ADM-001" }),
    "head.cs": await User.create({ email: "head.cs@sampoerna.ac.id", name: "Dr. Hendra Gunawan", roles: ["faculty_head", "lecturer"], department: dept, passwordHash, staffId: "FET-CS-001" }),
    lecturer1: await User.create({ email: "lecturer1@sampoerna.ac.id", name: "Dr. Rina Kusuma", roles: ["lecturer"], department: dept, passwordHash, staffId: "FET-CS-011" }),
    lecturer2: await User.create({ email: "lecturer2@sampoerna.ac.id", name: "Budi Santoso, M.Kom.", roles: ["lecturer"], department: dept, passwordHash, staffId: "FET-CS-012" }),
    lecturer3: await User.create({ email: "lecturer3@sampoerna.ac.id", name: "Dr. Sari Wulandari", roles: ["lecturer"], department: dept, passwordHash, staffId: "FET-CS-013" }),
  } as Record<string, InstanceType<typeof User>>;

  const roster = [...STUDENTS, ...EXTRA_STUDENTS, ...(LARGE ? largeStudents() : [])];
  const advisors = [staff.lecturer1._id, staff.lecturer2._id, staff.lecturer3._id, staff["head.cs"]._id];
  const students = await User.insertMany(
    roster.map((s, i) => ({
      email: `${s.key}@sampoerna.ac.id`,
      name: s.name,
      roles: ["student"],
      department: dept,
      curriculum: curriculum._id,
      studentId: s.nim,
      cohortYear: s.cohort,
      // The five named students keep lecturer1 as advisor; synthetic ones are spread across advisors.
      advisor: i < STUDENTS.length ? staff.lecturer1._id : advisors[i % advisors.length],
      passwordHash,
    })),
  );
  const profile = new Map(students.map((u, i) => [String(u._id), roster[i]]));

  let offeringCount = 0;
  let gradeCount = 0;
  for (const c of COURSES) {
    const course = await Course.create({
      curriculum: curriculum._id,
      code: c.code,
      title: c.title,
      sks: c.sks,
      semester: c.semester,
      plos: c.plos.map(ploId),
    });

    // One offering per (academic year, term) in which a cohort takes this course.
    const periods = new Map<string, { academicYear: number; term: Term; cohort: number }>();
    for (const cohort of COHORTS) {
      const p = semesterToPeriod(cohort, c.semester);
      if (!isFuture(p)) periods.set(`${p.academicYear}-${p.term}`, { ...p, cohort });
    }

    for (const p of periods.values()) {
      const offering = await CourseOffering.create({
        course: course._id,
        academicYear: p.academicYear,
        term: p.term,
        lecturers: [staff[c.lecturer]._id],
        threshold: 70,
      });
      offeringCount++;
      const enrolled = students.filter((s) => s.cohortYear === p.cohort);
      await Enrollment.insertMany(enrolled.map((s) => ({ offering: offering._id, student: s._id })));

      const assessments = await Assessment.insertMany(
        c.assessments.map((t) => ({
          offering: offering._id,
          title: t.title,
          maxPoints: t.max,
          gradeWeight: t.gradeWeight,
          ploWeights: splitTo100(t.plos).map(({ plo, weight }) => ({ plo: ploId(plo), weight })),
          source: "manual",
        })),
      );

      // In-progress term: only the first two assessments have been graded so far.
      const gradedCount = isCurrent(p) ? 2 : assessments.length;
      const grades = [];
      for (const [i, a] of assessments.slice(0, gradedCount).entries()) {
        const template = c.assessments[i];
        for (const s of enrolled) {
          const prof = profile.get(String(s._id))!;
          const entries = Object.entries(template.plos);
          const totalW = entries.reduce((sum, [, w]) => sum + w, 0);
          const expected = entries.reduce((sum, [n, w]) => sum + (prof.base + (prof.adj[Number(n)] ?? 0)) * w, 0) / totalW;
          if (!prof.extra) {
            const pct = Math.min(100, Math.max(25, expected + gaussian() * 6));
            grades.push({ assessment: a._id, offering: offering._id, student: s._id, score: Math.round((pct / 100) * a.maxPoints * 2) / 2 });
            continue;
          }
          // Extra students: semester trend, course difficulty, a wider spread and some missing work.
          if (rand2() < (prof.missing ?? 0)) continue; // never handed in: stays blank
          const trend = (prof.trend ?? 0) * (c.semester - 4);
          const badDay = rand2() < 0.04 ? -18 : 0;
          const pct = Math.min(100, Math.max(15, expected + trend + (c.difficulty ?? 0) + badDay + gaussian2() * 8));
          grades.push({ assessment: a._id, offering: offering._id, student: s._id, score: Math.round((pct / 100) * a.maxPoints * 2) / 2 });
        }
      }
      if (grades.length) await Grade.insertMany(grades);
      gradeCount += grades.length;
      await recomputeOffering(offering._id);
    }
  }

  console.log(`Seeded: 1 faculty, 1 department, 1 curriculum, ${plos.length} PLOs, ${COURSES.length} courses,`);
  console.log(`        ${offeringCount} offerings, ${Object.keys(staff).length + students.length} users, ${gradeCount} grades.`);
  console.log(`All seeded accounts use the dev password: ${SEED_PASSWORD}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
