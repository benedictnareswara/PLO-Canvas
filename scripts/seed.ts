/**
 * Seeds MongoDB with the Sampoerna University CS 2024 curriculum, users,
 * offerings, assessments and deterministic grades.
 *
 *   npm run seed            (drops the database first, then repopulates)
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

// Per-assessment PLO weights; for every course the weights of each PLO sum to 100%.
const COURSES: {
  code: string;
  title: string;
  sks: number;
  semester: number;
  plos: number[];
  lecturer: string;
  assessments: Template[];
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
];

// Ability profiles (expected %), with per-PLO adjustments to create realistic at-risk cases.
const STUDENTS = [
  { key: "student1", name: "Andi Wijaya", nim: "2023001", cohort: 2023, base: 87, adj: {} as Record<number, number> },
  { key: "student2", name: "Bunga Lestari", nim: "2023002", cohort: 2023, base: 79, adj: { 9: -12 } },
  { key: "student3", name: "Citra Pratama", nim: "2023003", cohort: 2023, base: 73, adj: { 1: -18, 2: -15, 6: -17 } },
  { key: "student4", name: "Dimas Saputra", nim: "2024001", cohort: 2024, base: 83, adj: { 5: -4 } },
  { key: "student5", name: "Eka Kurniawan", nim: "2024002", cohort: 2024, base: 77, adj: { 3: -28, 4: -32, 5: -12 } },
];

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
  } as Record<string, InstanceType<typeof User>>;

  const students = await User.insertMany(
    STUDENTS.map((s) => ({
      email: `${s.key}@sampoerna.ac.id`,
      name: s.name,
      roles: ["student"],
      department: dept,
      curriculum: curriculum._id,
      studentId: s.nim,
      cohortYear: s.cohort,
      advisor: staff.lecturer1._id,
      passwordHash,
    })),
  );
  const profile = new Map(students.map((u, i) => [String(u._id), STUDENTS[i]]));

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
    for (const cohort of [2023, 2024]) {
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
          ploWeights: Object.entries(t.plos).map(([n, weight]) => ({ plo: ploId(Number(n)), weight })),
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
          const pct = Math.min(100, Math.max(25, expected + gaussian() * 6));
          grades.push({ assessment: a._id, offering: offering._id, student: s._id, score: Math.round((pct / 100) * a.maxPoints * 2) / 2 });
        }
      }
      if (grades.length) await Grade.insertMany(grades);
      gradeCount += grades.length;
      await recomputeOffering(offering._id);
    }
  }

  console.log(`Seeded: 1 faculty, 1 department, 1 curriculum, ${plos.length} PLOs, ${COURSES.length} courses,`);
  console.log(`        ${offeringCount} offerings, ${4 + students.length} users, ${gradeCount} grades.`);
  console.log(`All seeded accounts use the dev password: ${SEED_PASSWORD}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
