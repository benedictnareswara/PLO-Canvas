/**
 * Role smoke test against a running app (npm run dev) and freshly seeded data:
 *
 *   npm run seed && npm run smoke
 *
 * Signs in as each demo role and checks the status codes of the main pages and APIs, so a change
 * that breaks access control or a whole screen shows up in seconds. Reads ids from the database;
 * writes nothing.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import mongoose from "mongoose";
import { Course, CourseOffering, User } from "../src/models";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const PASSWORD = "Password123!";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

let failures = 0;
async function expect(cookie: string, who: string, path: string, status: number) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const ok = res.status === status;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${who.padEnd(10)} ${path} → ${res.status}${ok ? "" : ` (expected ${status})`}`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
  const lecturer1 = await User.findOne({ email: "lecturer1@my.sampoernauniversity.ac.id" }).lean();
  const student21 = await User.findOne({ email: "student21@my.sampoernauniversity.ac.id" }).lean();
  const student1 = await User.findOne({ email: "student1@my.sampoernauniversity.ac.id" }).lean();
  if (!lecturer1 || !student21 || !student1) throw new Error("Seed data not found. Run npm run seed first.");
  const own = await CourseOffering.findOne({ lecturers: lecturer1._id }).lean();
  const other = await CourseOffering.findOne({ lecturers: { $ne: lecturer1._id } }).lean();
  if (!own || !other || !(await Course.exists({ _id: own.course }))) throw new Error("Classes not found");
  await mongoose.disconnect();

  const admin = await login("admin@my.sampoernauniversity.ac.id");
  const head = await login("head.cs@my.sampoernauniversity.ac.id");
  const lect = await login("lecturer1@my.sampoernauniversity.ac.id");
  const stud = await login("student21@my.sampoernauniversity.ac.id");

  for (const p of ["/admin", "/admin/users", "/admin/curriculum", "/admin/courses", "/admin/offerings"]) await expect(admin, "admin", p, 200);
  await expect(admin, "admin", "/api/admin/users", 200);
  await expect(admin, "admin", `/api/offerings/${other._id}/history`, 200);

  for (const p of ["/head", "/head/at-risk", "/head/courses", "/reports/cohort"]) await expect(head, "head", p, 200);
  await expect(head, "head", `/lecturer/offerings/${other._id}`, 200);
  await expect(head, "head", `/api/offerings/${other._id}/history`, 200);
  await expect(head, "head", `/students/${student1._id}`, 200);
  await expect(head, "head", "/api/admin/users", 403);

  for (const p of ["/lecturer", "/lecturer/advisees", `/lecturer/offerings/${own._id}`, `/reports/offering/${own._id}`]) await expect(lect, "lecturer1", p, 200);
  await expect(lect, "lecturer1", `/api/offerings/${own._id}/history`, 200);
  await expect(lect, "lecturer1", `/api/offerings/${other._id}/history`, 403);
  await expect(lect, "lecturer1", "/api/admin/users", 403);
  await expect(lect, "lecturer1", "/head", 307);

  await expect(stud, "student21", "/student", 200);
  await expect(stud, "student21", `/reports/student/${student21._id}`, 200);
  await expect(stud, "student21", `/api/offerings/${own._id}/history`, 403);
  await expect(stud, "student21", "/api/admin/users", 403);
  await expect(stud, "student21", "/head", 307);
  await expect(stud, "student21", "/admin", 307);

  await expect("", "anonymous", "/api/admin/users", 401);
  await expect("", "anonymous", "/student", 307);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
