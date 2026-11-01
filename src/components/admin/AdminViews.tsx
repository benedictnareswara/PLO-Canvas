"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserCheck, Users } from "lucide-react";
import { Badge, Button, Field, Input, Select, ToggleChip } from "@/components/ui";
import { Dialog, Notice, apiFetch } from "@/components/ui/client";
import { useUrlState } from "@/lib/hooks/useUrlState";
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
  const t = useTranslations("admin.curriculum");
  const [curriculumId, setCurriculumId] = useUrlState("curriculum", curricula[0]?._id ?? "");
  const facultyName = nameMap(faculties, (f) => f.code);
  const deptName = nameMap(departments, (d) => d.code);
  const shownPlos = plos.filter((p) => p.curriculum === curriculumId);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <ResourceSection
          resource="faculties"
          title={t("faculties")}
          addLabel={t("addFaculty")}
          itemName={(r) => r.code}
          rows={faculties}
          pageSize={10}
          columns={[
            { id: "code", header: t("code"), value: (r) => r.code, primary: true, cell: (r) => <span className="font-medium">{r.code}</span> },
            { id: "name", header: t("name"), value: (r) => r.name, cell: (r) => r.name },
          ]}
          fields={[
            { name: "code", label: t("code"), required: true },
            { name: "name", label: t("name"), required: true },
          ]}
        />
        <ResourceSection
          resource="departments"
          title={t("departments")}
          addLabel={t("addDepartment")}
          itemName={(r) => r.code}
          rows={departments}
          pageSize={10}
          columns={[
            { id: "code", header: t("code"), value: (r) => r.code, primary: true, cell: (r) => <span className="font-medium">{r.code}</span> },
            { id: "name", header: t("name"), value: (r) => r.name, cell: (r) => r.name },
            { id: "faculty", header: t("faculty"), value: (r) => facultyName.get(r.faculty) ?? "", cell: (r) => facultyName.get(r.faculty) },
          ]}
          fields={[
            { name: "code", label: t("code"), required: true },
            { name: "name", label: t("name"), required: true },
            { name: "faculty", label: t("faculty"), type: "select", required: true, options: opt(faculties, (f) => `${f.code} · ${f.name}`), wide: true },
          ]}
        />
      </div>

      <ResourceSection
        resource="curricula"
        title={t("curricula")}
        addLabel={t("addCurriculum")}
        itemName={(r) => r.name}
        rows={curricula}
        defaults={{ defaultThreshold: 70, isActive: true }}
        columns={[
          { id: "name", header: t("name"), value: (r) => r.name, primary: true, cell: (r) => <span className="font-medium">{r.name}</span> },
          { id: "department", header: t("department"), value: (r) => deptName.get(r.department) ?? "", cell: (r) => deptName.get(r.department) },
          { id: "year", header: t("year"), value: (r) => r.year, numeric: true, cell: (r) => r.year },
          { id: "sks", header: t("totalSks"), value: (r) => r.totalSks, numeric: true, cell: (r) => r.totalSks },
          { id: "target", header: t("target"), value: (r) => r.defaultThreshold, numeric: true, cell: (r) => `${r.defaultThreshold}%` },
          { id: "status", header: t("status"), value: (r) => (r.isActive ? 1 : 0), cell: (r) => (r.isActive ? <Badge tone="ok">{t("active")}</Badge> : <Badge>{t("inactive")}</Badge>) },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, wide: true },
          { name: "department", label: t("department"), type: "select", required: true, options: opt(departments, (d) => `${d.code} · ${d.name}`) },
          { name: "year", label: t("year"), type: "number", required: true },
          { name: "totalSks", label: t("totalSks"), type: "number", required: true },
          { name: "defaultThreshold", label: t("defaultTarget"), type: "number", required: true },
          { name: "isActive", label: t("active"), type: "checkbox" },
        ]}
      />

      <ResourceSection
        resource="plos"
        title={t("plos")}
        description={t("plosDescription")}
        addLabel={t("addPlo")}
        itemName={(r) => r.code}
        rows={shownPlos}
        defaults={{ curriculum: curriculumId, number: shownPlos.length + 1 }}
        extraActions={
          <Select value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)} aria-label={t("curriculum")}>
            {curricula.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        }
        columns={[
          { id: "number", header: t("code"), value: (r) => r.number, primary: true, cell: (r) => <span className="font-medium whitespace-nowrap">{r.code}</span> },
          { id: "short", header: t("shortLabel"), value: (r) => r.shortLabel, cell: (r) => r.shortLabel },
          { id: "description", header: t("description"), value: (r) => r.description, cell: (r) => <span className="text-muted">{r.description}</span> },
        ]}
        fields={[
          { name: "curriculum", label: t("curriculum"), type: "select", required: true, options: opt(curricula, (c) => c.name) },
          { name: "number", label: t("number"), type: "number", required: true },
          { name: "shortLabel", label: t("shortLabel"), required: true, wide: true },
          { name: "description", label: t("description"), type: "textarea", required: true },
        ]}
      />
    </div>
  );
}

/* -------------------------------- Courses -------------------------------- */

export function CoursesAdmin({ courses, curricula, plos }: { courses: CourseRow[]; curricula: CurriculumRow[]; plos: PloRow[] }) {
  const t = useTranslations("admin.courses");
  const [unmappedOnly, setUnmappedOnly] = useUrlState("unmapped", false, { parse: (r) => r === "1", serialize: (v) => (v ? "1" : "") });
  const ploCode = nameMap(plos, (p) => p.code);
  const ploNumber = new Map(plos.map((p) => [p._id, p.number]));
  const curriculumName = nameMap(curricula, (c) => c.name);
  const rows = unmappedOnly ? courses.filter((c) => c.plos.length === 0) : courses;
  return (
    <ResourceSection
      resource="courses"
      title={t("title")}
      description={t("description")}
      addLabel={t("add")}
      itemName={(r) => r.code}
      rows={rows}
      defaults={{ curriculum: curricula[0]?._id, plos: [], sks: 3, semester: 1 }}
      toolbar={
        <ToggleChip checked={unmappedOnly} onChange={setUnmappedOnly}>
          {t("unmappedOnly", { count: courses.filter((c) => c.plos.length === 0).length })}
        </ToggleChip>
      }
      columns={[
        { id: "code", header: t("code"), value: (r) => r.code, primary: true, cell: (r) => <span className="font-medium">{r.code}</span> },
        { id: "title", header: t("courseTitle"), value: (r) => r.title, cell: (r) => r.title },
        { id: "sks", header: "SKS", value: (r) => r.sks, numeric: true, cell: (r) => r.sks },
        { id: "semester", header: t("semester"), value: (r) => r.semester, numeric: true, cell: (r) => r.semester },
        {
          id: "plos",
          header: t("mapped"),
          value: (r) => r.plos.map((p) => ploCode.get(p) ?? "?").join(", "),
          cell: (r) =>
            r.plos.length ? (
              <div className="flex flex-wrap gap-1">
                {[...r.plos]
                  .sort((a, b) => (ploNumber.get(a) ?? 0) - (ploNumber.get(b) ?? 0))
                  .map((p) => (
                    <Badge key={p} tone="info">
                      {ploCode.get(p) ?? "?"}
                    </Badge>
                  ))}
              </div>
            ) : (
              <Badge tone="warn">{t("notMapped")}</Badge>
            ),
        },
        { id: "curriculum", header: t("curriculum"), value: (r) => curriculumName.get(r.curriculum) ?? "", cell: (r) => <span className="text-xs text-muted">{curriculumName.get(r.curriculum)}</span> },
      ]}
      fields={[
        { name: "code", label: t("code"), required: true, placeholder: "COMP1401" },
        { name: "curriculum", label: t("curriculum"), type: "select", required: true, options: opt(curricula, (c) => c.name) },
        { name: "title", label: t("courseTitle"), required: true, wide: true },
        { name: "sks", label: t("sks"), type: "number", required: true },
        { name: "semester", label: t("recommendedSemester"), type: "number", required: true },
        { name: "plos", label: t("mapped"), type: "multiselect", options: [...plos].sort((a, b) => a.number - b.number).map((p) => ({ value: p._id, label: `${p.code} · ${p.shortLabel}` })) },
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
  const t = useTranslations("admin.offerings");
  const [rosterFor, setRosterFor] = useState<OfferingRow | null>(null);
  const [unassignedOnly, setUnassignedOnly] = useUrlState("unassigned", false, { parse: (r) => r === "1", serialize: (v) => (v ? "1" : "") });
  const courseLabel = nameMap(courses, (c) => `${c.code} · ${c.title}`);
  const courseCode = nameMap(courses, (c) => c.code);
  const lecturers = users.filter((u) => u.roles.includes("lecturer") || u.roles.includes("faculty_head"));
  const lecturerName = nameMap(lecturers, (u) => u.name);
  const students = users.filter((u) => u.roles.includes("student"));
  const rows = unassignedOnly ? offerings.filter((o) => o.lecturers.length === 0) : offerings;

  return (
    <>
      <ResourceSection
        resource="offerings"
        title={t("title")}
        description={t("description")}
        addLabel={t("add")}
        itemName={(r) => `${courseCode.get(r.course) ?? ""} ${offeringPeriodLabel(r.academicYear, r.term)} ${r.section}`}
        rows={rows}
        defaults={{ academicYear: new Date().getFullYear(), term: "odd", section: "A", threshold: 70, lecturers: [] }}
        toolbar={
          <ToggleChip checked={unassignedOnly} onChange={setUnassignedOnly}>
            {t("unassignedOnly", { count: offerings.filter((o) => o.lecturers.length === 0).length })}
          </ToggleChip>
        }
        columns={[
          { id: "course", header: t("course"), value: (r) => courseLabel.get(r.course) ?? "", primary: true, cell: (r) => <span className="font-medium">{courseLabel.get(r.course)}</span> },
          { id: "period", header: t("period"), value: (r) => r.academicYear * 10 + (r.term === "even" ? 1 : 0), cell: (r) => <span className="whitespace-nowrap">{offeringPeriodLabel(r.academicYear, r.term)}</span> },
          { id: "section", header: t("section"), value: (r) => r.section, cell: (r) => r.section },
          {
            id: "lecturers",
            header: t("lecturers"),
            value: (r) => r.lecturers.map((l) => lecturerName.get(l)).join(", "),
            cell: (r) => r.lecturers.map((l) => lecturerName.get(l)).join(", ") || <Badge tone="risk">{t("unassigned")}</Badge>,
          },
          { id: "students", header: t("students"), value: (r) => roster[r._id]?.length ?? 0, numeric: true, cell: (r) => roster[r._id]?.length ?? 0 },
          { id: "target", header: t("target"), value: (r) => r.threshold, numeric: true, cell: (r) => `${r.threshold}%` },
        ]}
        rowActions={(r) => (
          <Button size="sm" variant="ghost" onClick={() => setRosterFor(r)} aria-label={t("rosterFor", { name: courseCode.get(r.course) ?? "" })}>
            <Users aria-hidden /> {t("roster")}
          </Button>
        )}
        fields={[
          { name: "course", label: t("course"), type: "select", required: true, options: opt(courses, (c) => `${c.code} · ${c.title}`), wide: true },
          { name: "academicYear", label: t("academicYear"), type: "number", required: true, hint: t("academicYearHint") },
          { name: "term", label: t("term"), type: "select", required: true, options: [{ value: "odd", label: t("odd") }, { value: "even", label: t("even") }] },
          { name: "section", label: t("section"), required: true },
          { name: "threshold", label: t("threshold"), type: "number", required: true },
          { name: "lecturers", label: t("lecturers"), type: "multiselect", options: opt(lecturers, (u) => u.name) },
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
  const t = useTranslations("admin.roster");
  const router = useRouter();
  const [selected, setSelected] = useState(new Set(enrolled));
  const [cohort, setCohort] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cohorts = [...new Set(students.map((s) => s.cohortYear).filter(Boolean))].sort();
  const q = query.trim().toLowerCase();
  const shown = students.filter((s) => (cohort === "all" || String(s.cohortYear) === cohort) && (!q || `${s.name} ${s.studentId ?? ""}`.toLowerCase().includes(q)));
  const removed = enrolled.filter((id) => !selected.has(id)).length;
  const added = [...selected].filter((id) => !enrolled.includes(id)).length;
  const dirty = removed > 0 || added > 0;

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/enrollments/${offering._id}`, { method: "PUT", body: { students: [...selected] } });
      toast.success(t("saved", { count: selected.size }));
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dirty={dirty && !saving}
      size="lg"
      variant="sheet"
      title={t("title")}
      description={`${title} · ${offeringPeriodLabel(offering.academicYear, offering.term)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            {t("save", { count: selected.size })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="w-56" type="search" />
          <Select value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label={t("cohort")}>
            <option value="all">{t("allCohorts")}</option>
            {cohorts.map((c) => (
              <option key={c} value={String(c)}>
                {t("classOf", { year: c! })}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => setSelected(new Set([...selected, ...shown.map((s) => s._id)]))}>
            {t("selectShown")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set([...selected].filter((id) => !shown.some((s) => s._id === id))))}>
            {t("clearShown")}
          </Button>
        </div>
        <fieldset className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2">
          <legend className="sr-only">{t("students")}</legend>
          {shown.map((s) => (
            <label key={s._id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2 pointer-coarse:py-2">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={selected.has(s._id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(s._id);
                  else next.delete(s._id);
                  setSelected(next);
                }}
              />
              <span>
                {s.name}{" "}
                <span className="text-xs text-muted tabular">
                  {s.studentId} · {s.cohortYear}
                </span>
              </span>
            </label>
          ))}
          {shown.length === 0 && <p className="p-2 text-sm text-muted">{t("noMatch")}</p>}
        </fieldset>
        <p className="text-xs text-muted" aria-live="polite">
          {t("changes", { added, removed })}
        </p>
        {removed > 0 && <Notice tone="warn">{t("removeWarning", { count: removed })}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}

/* --------------------------------- Users --------------------------------- */

const ROLES = ["superadmin", "faculty_head", "lecturer", "student"] as const;
const ROLE_TONE: Record<string, "brand" | "info" | "neutral" | "ok"> = { superadmin: "brand", faculty_head: "info", lecturer: "ok", student: "neutral" };

export function UsersAdmin({ users, departments, curricula }: { users: UserRow[]; departments: DepartmentRow[]; curricula: CurriculumRow[] }) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("roles");
  const [role, setRole] = useUrlState("role", "all");
  const [advisorFilter, setAdvisorFilter] = useUrlState("advisor", "all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const lecturers = users.filter((u) => u.roles.includes("lecturer") || u.roles.includes("faculty_head"));
  const userName = nameMap(users, (u) => u.name);
  const isStudent = (v: Record<string, unknown>) => ((v.roles as string[]) ?? []).includes("student");
  const isStaff = (v: Record<string, unknown>) => ((v.roles as string[]) ?? []).some((r) => r !== "student");
  const roleOptions = ROLES.map((r) => ({ value: r, label: tr(r) }));

  const shown = useMemo(
    () =>
      users.filter(
        (u) =>
          (role === "all" || u.roles.includes(role)) &&
          (advisorFilter === "all" || (advisorFilter === "none" && u.roles.includes("student") && !u.advisor)),
      ),
    [users, role, advisorFilter],
  );
  const selectedStudents = users.filter((u) => selected.has(u._id) && u.roles.includes("student"));

  return (
    <>
      <ResourceSection
        resource="users"
        title={t("title")}
        description={t("description")}
        addLabel={t("add")}
        itemName={(u) => u.name}
        rows={shown}
        selection={{ selected, onChange: setSelected }}
        defaults={{ roles: ["student"], isActive: true, department: departments[0]?._id, curriculum: curricula[0]?._id }}
        toForm={(u) => ({ ...u, password: "" })}
        toolbar={
          <>
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t("roleFilter")}>
              <option value="all">{t("allRoles")}</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <ToggleChip checked={advisorFilter === "none"} onChange={(on) => setAdvisorFilter(on ? "none" : "all")}>
              {t("noAdvisorOnly", { count: users.filter((u) => u.roles.includes("student") && !u.advisor).length })}
            </ToggleChip>
            {selected.size > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)} disabled={!selectedStudents.length}>
                <UserCheck aria-hidden /> {t("assignAdvisor", { count: selectedStudents.length })}
              </Button>
            )}
          </>
        }
        columns={[
          {
            id: "name",
            header: t("name"),
            value: (u) => `${u.name} ${u.email}`,
            primary: true,
            cell: (u) => (
              <>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </>
            ),
          },
          {
            id: "roles",
            header: t("roles"),
            value: (u) => u.roles.map((r) => tr(r)).join(", "),
            cell: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} tone={ROLE_TONE[r]}>
                    {tr(r)}
                  </Badge>
                ))}
                {!u.isActive && <Badge tone="risk">{t("inactive")}</Badge>}
              </div>
            ),
          },
          { id: "ids", header: t("ids"), value: (u) => u.studentId ?? u.staffId ?? "", cell: (u) => u.studentId ?? u.staffId ?? "—" },
          { id: "cohort", header: t("cohort"), value: (u) => u.cohortYear ?? null, numeric: true, cell: (u) => u.cohortYear ?? "—" },
          {
            id: "advisor",
            header: t("advisor"),
            value: (u) => (u.advisor ? (userName.get(u.advisor) ?? "") : ""),
            cell: (u) => (u.roles.includes("student") ? u.advisor ? userName.get(u.advisor) : <Badge tone="risk">{t("none")}</Badge> : "—"),
          },
        ]}
        fields={[
          { name: "name", label: t("fullName"), required: true },
          { name: "email", label: t("email"), type: "email", required: true },
          { name: "roles", label: t("roles"), type: "multiselect", required: true, options: roleOptions },
          { name: "password", label: t("password"), type: "password", required: true, hint: t("passwordHint") },
          { name: "department", label: t("department"), type: "select", options: opt(departments, (d) => `${d.code} · ${d.name}`) },
          { name: "isActive", label: t("accountActive"), type: "checkbox" },
          { name: "staffId", label: t("staffId"), when: isStaff },
          { name: "studentId", label: t("studentId"), when: isStudent },
          { name: "cohortYear", label: t("cohortYear"), type: "number", when: isStudent },
          { name: "curriculum", label: t("curriculum"), type: "select", options: opt(curricula, (c) => c.name), when: isStudent },
          { name: "advisor", label: t("advisor"), type: "select", options: opt(lecturers, (u) => u.name), when: isStudent },
        ] satisfies FieldDef[]}
      />
      {bulkOpen && (
        <BulkAdvisorDialog
          students={selectedStudents}
          lecturers={lecturers}
          onClose={(done) => {
            setBulkOpen(false);
            if (done) setSelected(new Set());
          }}
        />
      )}
    </>
  );
}

function BulkAdvisorDialog({ students, lecturers, onClose }: { students: UserRow[]; lecturers: UserRow[]; onClose: (done: boolean) => void }) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [advisor, setAdvisor] = useState(lecturers[0]?._id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const advisorName = nameMap(lecturers, (u) => u.name);

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/api/admin/advisors", { body: { students: students.map((s) => s._id), advisor: advisor || null } });
      toast.success(advisor ? t("assigned", { count: students.length, name: advisorName.get(advisor) ?? "" }) : t("advisorRemoved", { count: students.length }));
      router.refresh();
      onClose(true);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      size="md"
      variant="sheet"
      title={t("bulkTitle")}
      description={t("bulkDescription", { count: students.length })}
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={save} loading={saving}>
            {t("assignTo", { count: students.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t("advisor")} htmlFor="bulk-advisor">
          <Select id="bulk-advisor" className="w-full" value={advisor} onChange={(e) => setAdvisor(e.target.value)}>
            <option value="">{t("removeAdvisor")}</option>
            {lecturers.map((l) => (
              <option key={l._id} value={l._id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
          {students.map((s) => (
            <li key={s._id} className="flex justify-between gap-3 px-3 py-2">
              <span>{s.name}</span>
              <span className="text-xs text-muted">{t("currently", { name: s.advisor ? (advisorName.get(s.advisor) ?? "—") : t("none") })}</span>
            </li>
          ))}
        </ul>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Dialog>
  );
}
