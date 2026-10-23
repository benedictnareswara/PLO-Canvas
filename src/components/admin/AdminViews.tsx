"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Users } from "lucide-react";
import { Badge, Button, Field, Input, Select } from "@/components/ui";
import { Dialog, Notice, apiFetch } from "@/components/ui/client";
import { offeringPeriodLabel } from "@/lib/obe/semesters";
import type { CourseRow, CurriculumRow, DepartmentRow, FacultyRow, OfferingRow, PloRow, UserRow } from "@/lib/admin/data";
import { ResourceSection, type FieldDef } from "./ResourceSection";

const opt = <T extends { _id: string }>(rows: T[], label: (r: T) => string) => rows.map((r) => ({ value: r._id, label: label(r) }));
const nameMap = <T extends { _id: string }>(rows: T[], label: (r: T) => string) => new Map(rows.map((r) => [r._id, label(r)]));

/* ------------------------------ Curriculum ------------------------------- */

export function CurriculumAdmin({
  faculties,
  departments,
  curricula,
  plos,
}: {
  faculties: FacultyRow[];
  departments: DepartmentRow[];
  curricula: CurriculumRow[];
  plos: PloRow[];
}) {
  const [curriculumId, setCurriculumId] = useState(curricula[0]?._id ?? "");
  const facultyName = nameMap(faculties, (f) => f.code);
  const deptName = nameMap(departments, (d) => d.code);
  const shownPlos = plos.filter((p) => p.curriculum === curriculumId);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ResourceSection
          resource="faculties"
          title="Faculties"
          addLabel="Add faculty"
          rows={faculties}
          columns={[
            { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
            { header: "Name", cell: (r) => r.name },
          ]}
          fields={[
            { name: "code", label: "Code", required: true },
            { name: "name", label: "Name", required: true },
          ]}
        />
        <ResourceSection
          resource="departments"
          title="Departments"
          addLabel="Add department"
          rows={departments}
          columns={[
            { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
            { header: "Name", cell: (r) => r.name },
            { header: "Faculty", cell: (r) => facultyName.get(r.faculty) },
          ]}
          fields={[
            { name: "code", label: "Code", required: true },
            { name: "name", label: "Name", required: true },
            { name: "faculty", label: "Faculty", type: "select", required: true, options: opt(faculties, (f) => `${f.code} · ${f.name}`), wide: true },
          ]}
        />
      </div>

      <ResourceSection
        resource="curricula"
        title="Curricula"
        addLabel="Add curriculum"
        rows={curricula}
        defaults={{ defaultThreshold: 70, isActive: true }}
        columns={[
          { header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Department", cell: (r) => deptName.get(r.department) },
          { header: "Year", cell: (r) => r.year },
          { header: "Total SKS", cell: (r) => r.totalSks, className: "text-right" },
          { header: "Target", cell: (r) => `${r.defaultThreshold}%`, className: "text-right" },
          { header: "Status", cell: (r) => (r.isActive ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>) },
        ]}
        fields={[
          { name: "name", label: "Name", required: true, wide: true },
          { name: "department", label: "Department", type: "select", required: true, options: opt(departments, (d) => `${d.code} · ${d.name}`) },
          { name: "year", label: "Year", type: "number", required: true },
          { name: "totalSks", label: "Total SKS", type: "number", required: true },
          { name: "defaultThreshold", label: "Default PLO target (%)", type: "number", required: true },
          { name: "isActive", label: "Active", type: "checkbox" },
        ]}
      />

      <ResourceSection
        resource="plos"
        title="Program Learning Outcomes"
        description="PLO codes are generated from their number (PLO 1 … PLO n)."
        addLabel="Add PLO"
        rows={shownPlos}
        defaults={{ curriculum: curriculumId, number: shownPlos.length + 1 }}
        extraActions={
          <Select value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)} aria-label="Curriculum">
            {curricula.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        }
        columns={[
          { header: "Code", cell: (r) => <span className="whitespace-nowrap font-medium">{r.code}</span> },
          { header: "Short label", cell: (r) => r.shortLabel },
          { header: "Description", cell: (r) => <span className="text-muted">{r.description}</span> },
        ]}
        fields={[
          { name: "curriculum", label: "Curriculum", type: "select", required: true, options: opt(curricula, (c) => c.name) },
          { name: "number", label: "Number", type: "number", required: true },
          { name: "shortLabel", label: "Short label", required: true, wide: true },
          { name: "description", label: "Description", type: "textarea", required: true },
        ]}
      />
    </div>
  );
}

/* -------------------------------- Courses -------------------------------- */

export function CoursesAdmin({ courses, curricula, plos }: { courses: CourseRow[]; curricula: CurriculumRow[]; plos: PloRow[] }) {
  const ploCode = nameMap(plos, (p) => p.code);
  const curriculumName = nameMap(curricula, (c) => c.name);
  return (
    <ResourceSection
      resource="courses"
      title="Courses"
      description="Changing SKS or PLO mapping recalculates attainment for every offering of the course."
      addLabel="Add course"
      rows={courses}
      defaults={{ curriculum: curricula[0]?._id, plos: [], sks: 3, semester: 1 }}
      columns={[
        { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
        { header: "Title", cell: (r) => r.title },
        { header: "SKS", cell: (r) => r.sks, className: "text-right" },
        { header: "Sem", cell: (r) => r.semester, className: "text-right" },
        {
          header: "Mapped PLOs",
          cell: (r) => (
            <div className="flex flex-wrap gap-1">
              {r.plos
                .map((p) => ploCode.get(p) ?? "?")
                .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
                .map((c) => (
                  <Badge key={c} tone="info">
                    {c}
                  </Badge>
                ))}
            </div>
          ),
        },
        { header: "Curriculum", cell: (r) => <span className="text-xs text-muted">{curriculumName.get(r.curriculum)}</span> },
      ]}
      fields={[
        { name: "code", label: "Course code", required: true, placeholder: "COMP1401" },
        { name: "curriculum", label: "Curriculum", type: "select", required: true, options: opt(curricula, (c) => c.name) },
        { name: "title", label: "Title", required: true, wide: true },
        { name: "sks", label: "SKS (credits)", type: "number", required: true },
        { name: "semester", label: "Recommended semester", type: "number", required: true },
        { name: "plos", label: "Mapped PLOs", type: "multiselect", options: plos.map((p) => ({ value: p._id, label: `${p.code} · ${p.shortLabel}` })) },
      ]}
    />
  );
}

/* ------------------------------- Offerings ------------------------------- */

export function OfferingsAdmin({
  offerings,
  roster,
  courses,
  users,
}: {
  offerings: OfferingRow[];
  roster: Record<string, string[]>;
  courses: CourseRow[];
  users: UserRow[];
}) {
  const [rosterFor, setRosterFor] = useState<OfferingRow | null>(null);
  const courseLabel = nameMap(courses, (c) => `${c.code} · ${c.title}`);
  const lecturers = users.filter((u) => u.roles.includes("lecturer") || u.roles.includes("faculty_head"));
  const lecturerName = nameMap(lecturers, (u) => u.name);
  const students = users.filter((u) => u.roles.includes("student"));

  return (
    <>
      <ResourceSection
        resource="offerings"
        title="Course offerings"
        description="A course taught in a given academic year and term, with assigned lecturers and a passing threshold."
        addLabel="Add offering"
        rows={offerings}
        defaults={{ academicYear: new Date().getFullYear(), term: "odd", section: "A", threshold: 70, lecturers: [] }}
        columns={[
          { header: "Course", cell: (r) => <span className="font-medium">{courseLabel.get(r.course)}</span> },
          { header: "Period", cell: (r) => <span className="whitespace-nowrap">{offeringPeriodLabel(r.academicYear, r.term)}</span> },
          { header: "Sec", cell: (r) => r.section },
          { header: "Lecturers", cell: (r) => r.lecturers.map((l) => lecturerName.get(l)).join(", ") || <Badge tone="risk">Unassigned</Badge> },
          { header: "Students", cell: (r) => roster[r._id]?.length ?? 0, className: "text-right" },
          { header: "Target", cell: (r) => `${r.threshold}%`, className: "text-right" },
        ]}
        rowActions={(r) => (
          <Button size="sm" variant="ghost" onClick={() => setRosterFor(r)} aria-label="Edit roster">
            <Users className="size-3.5" /> Roster
          </Button>
        )}
        fields={[
          { name: "course", label: "Course", type: "select", required: true, options: opt(courses, (c) => `${c.code} · ${c.title}`), wide: true },
          { name: "academicYear", label: "Academic year (start)", type: "number", required: true, placeholder: "2026 for 2026/2027" },
          { name: "term", label: "Term", type: "select", required: true, options: [{ value: "odd", label: "Odd (Ganjil)" }, { value: "even", label: "Even (Genap)" }] },
          { name: "section", label: "Section", required: true },
          { name: "threshold", label: "Passing threshold (%)", type: "number", required: true },
          { name: "lecturers", label: "Lecturers", type: "multiselect", options: opt(lecturers, (u) => u.name) },
        ]}
      />
      {rosterFor && (
        <RosterDialog
          offering={rosterFor}
          title={courseLabel.get(rosterFor.course) ?? ""}
          students={students}
          enrolled={roster[rosterFor._id] ?? []}
          onClose={() => setRosterFor(null)}
        />
      )}
    </>
  );
}

function RosterDialog({
  offering,
  title,
  students,
  enrolled,
  onClose,
}: {
  offering: OfferingRow;
  title: string;
  students: UserRow[];
  enrolled: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(enrolled));
  const [cohort, setCohort] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const cohorts = [...new Set(students.map((s) => s.cohortYear).filter(Boolean))].sort();
  const shown = students.filter((s) => cohort === "all" || String(s.cohortYear) === cohort);
  const removed = enrolled.filter((id) => !selected.has(id)).length;

  async function save() {
    try {
      await apiFetch(`/api/admin/enrollments/${offering._id}`, { method: "PUT", body: { students: [...selected] } });
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Class roster"
      description={`${title} · ${offeringPeriodLabel(offering.academicYear, offering.term)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save roster ({selected.size})</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label="Cohort filter">
            <option value="all">All cohorts</option>
            {cohorts.map((c) => (
              <option key={c} value={String(c)}>
                Class of {c}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => setSelected(new Set([...selected, ...shown.map((s) => s._id)]))}>
            Select shown
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set([...selected].filter((id) => !shown.some((s) => s._id === id))))}>
            Clear shown
          </Button>
        </div>
        <div className="grid max-h-80 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
          {shown.map((s) => (
            <label key={s._id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-background">
              <input
                type="checkbox"
                className="accent-brand"
                checked={selected.has(s._id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(s._id);
                  else next.delete(s._id);
                  setSelected(next);
                }}
              />
              <span>
                {s.name} <span className="text-xs text-muted">{s.studentId} · {s.cohortYear}</span>
              </span>
            </label>
          ))}
        </div>
        {removed > 0 && <Notice tone="info">{removed} student(s) will be removed from this class along with their grades.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}

/* --------------------------------- Users --------------------------------- */

const ROLE_OPTIONS = [
  { value: "superadmin", label: "Superadmin" },
  { value: "faculty_head", label: "Faculty Head" },
  { value: "lecturer", label: "Lecturer" },
  { value: "student", label: "Student" },
];
const ROLE_TONE: Record<string, "brand" | "info" | "neutral" | "ok"> = { superadmin: "brand", faculty_head: "info", lecturer: "ok", student: "neutral" };

export function UsersAdmin({ users, departments, curricula }: { users: UserRow[]; departments: DepartmentRow[]; curricula: CurriculumRow[] }) {
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const lecturers = users.filter((u) => u.roles.includes("lecturer") || u.roles.includes("faculty_head"));
  const userName = nameMap(users, (u) => u.name);
  const isStudent = (v: Record<string, unknown>) => ((v.roles as string[]) ?? []).includes("student");
  const isStaff = (v: Record<string, unknown>) => ((v.roles as string[]) ?? []).some((r) => r !== "student");

  const shown = useMemo(
    () =>
      users.filter(
        (u) =>
          (role === "all" || u.roles.includes(role)) &&
          (!query || `${u.name} ${u.email} ${u.studentId ?? ""}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [users, role, query],
  );

  return (
    <>
      <ResourceSection
        resource="users"
        title="Users"
        description="Assign roles, departments and the Academic Advisor (Dosen Wali) for each student."
        addLabel="Add user"
        rows={shown}
        defaults={{ roles: ["student"], isActive: true, department: departments[0]?._id, curriculum: curricula[0]?._id }}
        toForm={(u) => ({ ...u, password: "" })}
        extraActions={
          <>
            <Input placeholder="Search name, email, NIM" value={query} onChange={(e) => setQuery(e.target.value)} className="w-52" />
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role filter">
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setBulkOpen(true)}>
              <UserCheck className="size-4" /> Assign advisor
            </Button>
          </>
        }
        columns={[
          {
            header: "Name",
            cell: (u) => (
              <>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </>
            ),
          },
          {
            header: "Roles",
            cell: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} tone={ROLE_TONE[r]}>
                    {ROLE_OPTIONS.find((o) => o.value === r)?.label}
                  </Badge>
                ))}
                {!u.isActive && <Badge tone="risk">Inactive</Badge>}
              </div>
            ),
          },
          { header: "NIM / Staff ID", cell: (u) => u.studentId ?? u.staffId ?? "—" },
          { header: "Cohort", cell: (u) => u.cohortYear ?? "—" },
          { header: "Advisor (Dosen Wali)", cell: (u) => (u.roles.includes("student") ? (u.advisor ? userName.get(u.advisor) : <Badge tone="risk">None</Badge>) : "—") },
        ]}
        fields={[
          { name: "name", label: "Full name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "roles", label: "Roles", type: "multiselect", options: ROLE_OPTIONS },
          { name: "password", label: "Password (min 8 chars; leave blank to keep)", type: "password", required: true },
          { name: "department", label: "Department", type: "select", options: opt(departments, (d) => `${d.code} · ${d.name}`) },
          { name: "isActive", label: "Account active", type: "checkbox" },
          { name: "staffId", label: "Staff ID", when: isStaff },
          { name: "studentId", label: "Student ID (NIM)", when: isStudent },
          { name: "cohortYear", label: "Cohort (intake year)", type: "number", when: isStudent },
          { name: "curriculum", label: "Curriculum", type: "select", options: opt(curricula, (c) => c.name), when: isStudent },
          { name: "advisor", label: "Academic advisor (Dosen Wali)", type: "select", options: opt(lecturers, (u) => u.name), when: isStudent },
        ] satisfies FieldDef[]}
      />
      {bulkOpen && <BulkAdvisorDialog students={users.filter((u) => u.roles.includes("student"))} lecturers={lecturers} onClose={() => setBulkOpen(false)} />}
    </>
  );
}

function BulkAdvisorDialog({ students, lecturers, onClose }: { students: UserRow[]; lecturers: UserRow[]; onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advisor, setAdvisor] = useState(lecturers[0]?._id ?? "");
  const [error, setError] = useState<string | null>(null);
  const advisorName = nameMap(lecturers, (u) => u.name);

  async function save() {
    try {
      await apiFetch("/api/admin/advisors", { body: { students: [...selected], advisor: advisor || null } });
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Assign Academic Advisor (Dosen Wali)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!selected.size}>
            Assign to {selected.size} student(s)
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Advisor">
          <Select className="w-full" value={advisor} onChange={(e) => setAdvisor(e.target.value)}>
            <option value="">— Remove advisor —</option>
            {lecturers.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid max-h-80 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
          {students.map((s) => (
            <label key={s._id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-background">
              <input
                type="checkbox"
                className="accent-brand"
                checked={selected.has(s._id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(s._id);
                  else next.delete(s._id);
                  setSelected(next);
                }}
              />
              <span>
                {s.name} <span className="text-xs text-muted">· now: {s.advisor ? advisorName.get(s.advisor) : "none"}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}
