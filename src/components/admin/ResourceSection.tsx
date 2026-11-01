"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, NumberInput, Select, Textarea, ToggleChip, cn } from "@/components/ui";
import { Dialog, Notice, Tooltip, apiFetch, useConfirm } from "@/components/ui/client";
import { DataTable } from "@/components/ui/data-table";
import { ExportMenu } from "@/components/ExportMenu";
import { downloadCsv, safeFilename, type Cell, type ExportColumn } from "@/lib/export/csv";
import { parseScore } from "@/lib/gradebook/parse-score";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "select" | "multiselect" | "checkbox" | "password";
  options?: { value: string; label: string }[];
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
  hint?: string;
  /** Only shown when this returns true for the current form values. */
  when?: (values: Record<string, unknown>) => boolean;
  /** Omit from the request when empty (e.g. password on edit). */
  optional?: boolean;
};

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Plain value for sorting, search and export. Columns without one are display-only. */
  value?: (row: T) => Cell;
  numeric?: boolean;
  primary?: boolean;
}

type Row = { _id: string } & Record<string, unknown>;

function toBody(fields: FieldDef[], values: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.when && !f.when(values)) continue;
    const v = values[f.name];
    if (f.optional && (v === "" || v === undefined)) continue;
    if (f.type === "number") body[f.name] = v === "" || v === undefined || v === null ? null : parseScore(String(v));
    else if (f.type === "checkbox") body[f.name] = Boolean(v);
    else if (f.type === "multiselect") body[f.name] = (v as string[]) ?? [];
    else if (f.type === "select") body[f.name] = v === "" ? null : v;
    else body[f.name] = v ?? "";
  }
  return body;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create/edit form for one admin resource. Fields validate once left (or after a submit attempt);
 * a failed submit focuses an error summary linking to each field. Closing with edits asks first.
 */
export function ResourceForm({
  resource,
  title,
  fields,
  initial,
  id,
  onClose,
}: {
  resource: string;
  title: string;
  fields: FieldDef[];
  initial: Record<string, unknown>;
  id?: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin.form");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));
  const touch = (name: string) => setTouched((s) => new Set(s).add(name));
  const visible = fields.filter((f) => !f.when || f.when(values));
  const fid = (name: string) => `rf-${name}`;

  const errors: Record<string, string> = {};
  for (const f of visible) {
    const v = values[f.name];
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) errors[f.name] = t(f.type === "multiselect" || f.type === "select" ? "errors.choose" : "errors.required", { field: f.label });
    else if (!empty && f.type === "email" && !EMAIL.test(String(v))) errors[f.name] = t("errors.email");
    else if (!empty && f.type === "number" && Number.isNaN(parseScore(String(v)) ?? NaN)) errors[f.name] = t("errors.number", { field: f.label });
    else if (!empty && f.type === "password" && String(v).length < 8) errors[f.name] = t("errors.password");
  }
  const show = (name: string) => (attempted || touched.has(name) ? errors[name] : undefined);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setServerError(null);
    if (Object.keys(errors).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/${resource}${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: toBody(fields, values) });
      toast.success(id ? t("saved") : t("created"));
      router.refresh();
      onClose();
    } catch (err) {
      setServerError((err as Error).message);
      setSaving(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  const failed = (attempted && Object.keys(errors).length > 0) || serverError;

  return (
    <Dialog
      open
      onClose={onClose}
      dirty={dirty && !saving}
      size="lg"
      variant="sheet"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="resource-form" loading={saving}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {failed && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border-2 border-risk/60 bg-risk-soft p-3 text-sm outline-none sm:col-span-2">
            <p className="font-semibold text-risk">{serverError ? t("serverError") : t("summaryTitle")}</p>
            {serverError ? (
              <p className="mt-1">{serverError}</p>
            ) : (
              <ul className="mt-1 list-inside list-disc">
                {Object.entries(errors).map(([name, msg]) => (
                  <li key={name}>
                    <a href={`#${fid(name)}`} className="text-risk underline underline-offset-2" onClick={(e) => (e.preventDefault(), document.getElementById(fid(name))?.focus())}>
                      {msg}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {visible.map((f) => {
          const err = show(f.name);
          const common = {
            id: fid(f.name),
            "aria-invalid": err ? true : undefined,
            "aria-describedby": err ? `${fid(f.name)}-error` : f.hint ? `${fid(f.name)}-hint` : undefined,
            onBlur: () => touch(f.name),
          };
          const wide = f.wide || f.type === "multiselect" || f.type === "textarea";
          if (f.type === "multiselect") {
            const arr = (values[f.name] as string[]) ?? [];
            return (
              <fieldset key={f.name} id={fid(f.name)} tabIndex={-1} className={cn("outline-none", wide && "sm:col-span-2")} aria-describedby={err ? `${fid(f.name)}-error` : undefined}>
                <legend className="mb-1.5 text-xs font-medium text-muted">
                  {f.label}
                  {f.required && <span aria-hidden> *</span>}
                </legend>
                <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                  {f.options?.map((o) => (
                    <ToggleChip
                      key={o.value}
                      checked={arr.includes(o.value)}
                      onChange={(on) => {
                        set(f.name, on ? [...arr, o.value] : arr.filter((x) => x !== o.value));
                        touch(f.name);
                      }}
                    >
                      {o.label}
                    </ToggleChip>
                  ))}
                </div>
                {err && (
                  <p id={`${fid(f.name)}-error`} className="mt-1.5 text-xs font-medium text-risk">
                    {err}
                  </p>
                )}
              </fieldset>
            );
          }
          if (f.type === "checkbox") {
            return (
              <label key={f.name} className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" className="size-4 accent-brand" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                {f.label}
              </label>
            );
          }
          return (
            <Field key={f.name} label={<>{f.label}{f.required && <span aria-hidden> *</span>}</>} htmlFor={fid(f.name)} hint={f.hint} error={err} className={cn(wide && "sm:col-span-2")}>
              {f.type === "textarea" ? (
                <Textarea {...common} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
              ) : f.type === "select" ? (
                <Select {...common} className="w-full" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.type === "number" ? (
                <NumberInput {...common} className="text-left" value={String(values[f.name] ?? "")} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <Input
                  {...common}
                  type={f.type ?? "text"}
                  autoComplete={f.type === "password" ? "new-password" : f.type === "email" ? "off" : undefined}
                  value={String(values[f.name] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Field>
          );
        })}
      </form>
    </Dialog>
  );
}

/** Card with a searchable, sortable, paginated, exportable table and add/edit/delete for one admin resource. */
export function ResourceSection<T extends Row>({
  resource,
  title,
  description,
  rows,
  columns,
  fields,
  itemName,
  toForm,
  defaults = {},
  extraActions,
  toolbar,
  rowActions,
  addLabel,
  selection,
  pageSize = 25,
}: {
  resource: string;
  title: string;
  description?: string;
  rows: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  /** How a row is named in dialogs ("COMP1401", "Andi Wijaya"). */
  itemName: (row: T) => string;
  toForm?: (row: T) => Record<string, unknown>;
  defaults?: Record<string, unknown>;
  extraActions?: ReactNode;
  toolbar?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  addLabel: string;
  selection?: { selected: Set<string>; onChange: React.Dispatch<React.SetStateAction<Set<string>>> };
  pageSize?: number;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(row: T) {
    const name = itemName(row);
    setError(null);
    let deps: { key: string; count: number; blocking: boolean }[] = [];
    try {
      deps = (await apiFetch<{ dependents: typeof deps }>(`/api/admin/${resource}/${row._id}?dependents=1`)).dependents.filter((d) => d.count > 0);
    } catch {
      /* the server re-checks on delete; the dialog just says less */
    }
    const blocking = deps.filter((d) => d.blocking);
    const list = (ds: typeof deps) => (
      <ul className="mt-2 list-inside list-disc">
        {ds.map((d) => (
          <li key={d.key}>{t(`dependents.${d.key}`, { count: d.count })}</li>
        ))}
      </ul>
    );
    if (blocking.length) {
      await confirm({ title: t("cannotDeleteTitle", { name }), body: <>{t("cannotDeleteBody")}{list(blocking)}</>, infoOnly: true });
      return;
    }
    const ok = await confirm({
      title: t("deleteTitle", { name }),
      body: deps.length ? <>{t("deleteCascade")}{list(deps)}<p className="mt-2">{t("cannotUndo")}</p></> : t("cannotUndo"),
      confirmLabel: t("deleteAction"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/admin/${resource}/${row._id}`, { method: "DELETE" });
      toast.success(t("deleted", { name }));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const tableColumns = useMemo(() => {
    const col = createColumnHelper<T>();
    const defs: ColumnDef<T, unknown>[] = columns.map((c) =>
      c.value
        ? (col.accessor((r) => c.value!(r) ?? "", {
            id: c.id,
            header: c.header,
            meta: { numeric: c.numeric, primary: c.primary, label: c.header },
            cell: ({ row }) => c.cell(row.original),
          }) as ColumnDef<T, unknown>)
        : col.display({ id: c.id, header: c.header, meta: { label: c.header }, cell: ({ row }) => c.cell(row.original) }),
    );
    defs.push(
      col.display({
        id: "__actions",
        header: () => <span className="sr-only">{t("actions")}</span>,
        meta: { className: "text-right whitespace-nowrap" },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-0.5">
            {rowActions?.(row.original)}
            <Tooltip content={t("edit")}>
              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(row.original)} aria-label={t("editNamed", { name: itemName(row.original) })}>
                <Pencil />
              </Button>
            </Tooltip>
            <Tooltip content={t("delete")}>
              <Button size="icon-sm" variant="danger-ghost" onClick={() => remove(row.original)} aria-label={t("deleteNamed", { name: itemName(row.original) })}>
                <Trash2 />
              </Button>
            </Tooltip>
          </span>
        ),
      }) as ColumnDef<T, unknown>,
    );
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rowActions, t]);

  const exportColumns: ExportColumn<T>[] = columns.filter((c) => c.value).map((c) => ({ header: c.header, value: c.value! }));
  const file = safeFilename(resource);

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          <>
            {extraActions}
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden /> {addLabel}
            </Button>
          </>
        }
      />
      {error && (
        <div className="px-5 pt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <DataTable
        data={rows}
        columns={tableColumns}
        label={title}
        searchable
        pageSize={pageSize}
        urlKey={`${resource}-`}
        getRowId={(r) => r._id}
        selection={selection ? { ...selection, name: itemName } : undefined}
        toolbar={toolbar}
        empty={<p className="py-6 text-center text-sm text-muted">{t("empty")}</p>}
        exportSlot={
          <ExportMenu
            size="sm"
            items={[
              { key: "csv", label: "CSV", format: "csv", run: () => downloadCsv(`${file}.csv`, rows, exportColumns) },
              { key: "xlsx", label: "Excel", format: "xlsx", run: async () => (await import("@/lib/export/xlsx")).downloadXlsx(`${file}.xlsx`, [{ name: title, rows, columns: exportColumns }]) },
            ]}
          />
        }
      />
      {editing && (
        <ResourceForm
          resource={resource}
          title={editing === "new" ? addLabel : t("editNamed", { name: itemName(editing) })}
          fields={editing === "new" ? fields : fields.map((f) => (f.type === "password" ? { ...f, required: false, optional: true } : f))}
          initial={editing === "new" ? defaults : (toForm ?? ((r: T) => r))(editing)}
          id={editing === "new" ? undefined : editing._id}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
