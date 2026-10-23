"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Select, Table, Td, Th, cn } from "@/components/ui";
import { Dialog, Notice, apiFetch } from "@/components/ui/client";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "select" | "multiselect" | "checkbox" | "password";
  options?: { value: string; label: string }[];
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
  /** Only shown when this returns true for the current form values. */
  when?: (values: Record<string, unknown>) => boolean;
  /** Omit from the request when empty (e.g. password on edit). */
  optional?: boolean;
};

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

type Row = { _id: string } & Record<string, unknown>;

function toBody(fields: FieldDef[], values: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.when && !f.when(values)) continue;
    const v = values[f.name];
    if (f.optional && (v === "" || v === undefined)) continue;
    if (f.type === "number") body[f.name] = v === "" || v === undefined || v === null ? null : Number(v);
    else if (f.type === "checkbox") body[f.name] = Boolean(v);
    else if (f.type === "multiselect") body[f.name] = (v as string[]) ?? [];
    else if (f.type === "select") body[f.name] = v === "" ? null : v;
    else body[f.name] = v ?? "";
  }
  return body;
}

export function ResourceForm({
  resource,
  title,
  fields,
  initial,
  id,
  onClose,
  extra,
}: {
  resource: string;
  title: string;
  fields: FieldDef[];
  initial: Record<string, unknown>;
  id?: string;
  onClose: () => void;
  extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/${resource}${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: { ...toBody(fields, values), ...extra },
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="resource-form" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {fields
          .filter((f) => !f.when || f.when(values))
          .map((f) => (
            <Field key={f.name} label={f.label + (f.required ? " *" : "")} className={cn((f.wide || f.type === "multiselect" || f.type === "textarea") && "sm:col-span-2")}>
              {f.type === "textarea" ? (
                <textarea
                  className="min-h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                  value={String(values[f.name] ?? "")}
                  required={f.required}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              ) : f.type === "select" ? (
                <Select className="w-full" value={String(values[f.name] ?? "")} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.type === "multiselect" ? (
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                  {f.options?.map((o) => {
                    const arr = (values[f.name] as string[]) ?? [];
                    return (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={arr.includes(o.value)}
                          onChange={(e) => set(f.name, e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))}
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              ) : f.type === "checkbox" ? (
                <label className="flex h-9 items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                  Enabled
                </label>
              ) : (
                <Input
                  type={f.type ?? "text"}
                  step={f.type === "number" ? "any" : undefined}
                  value={String(values[f.name] ?? "")}
                  required={f.required}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Field>
          ))}
        {error && (
          <div className="sm:col-span-2">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </form>
    </Dialog>
  );
}

/** Card + table + add/edit/delete dialogs for one admin resource. */
export function ResourceSection<T extends Row>({
  resource,
  title,
  description,
  rows,
  columns,
  fields,
  toForm,
  defaults = {},
  extraActions,
  rowActions,
  addLabel = "Add",
}: {
  resource: string;
  title: string;
  description?: string;
  rows: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  toForm?: (row: T) => Record<string, unknown>;
  defaults?: Record<string, unknown>;
  extraActions?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  addLabel?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(row: T) {
    if (!confirm(`Delete this ${title.toLowerCase().replace(/s$/, "")}? This cannot be undone.`)) return;
    setError(null);
    try {
      await apiFetch(`/api/admin/${resource}/${row._id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          <>
            {extraActions}
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> {addLabel}
            </Button>
          </>
        }
      />
      {error && (
        <div className="px-5 pt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={c.header} className={c.className}>
                {c.header}
              </Th>
            ))}
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="hover:bg-background">
              {columns.map((c) => (
                <Td key={c.header} className={c.className}>
                  {c.cell(row)}
                </Td>
              ))}
              <Td className="whitespace-nowrap text-right">
                {rowActions?.(row)}
                <Button size="sm" variant="ghost" onClick={() => setEditing(row)} aria-label="Edit">
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(row)} aria-label="Delete">
                  <Trash2 className="size-3.5 text-risk" />
                </Button>
              </Td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <Td colSpan={columns.length + 1} className="py-6 text-center text-muted">
                Nothing here yet.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      {editing && (
        <ResourceForm
          resource={resource}
          title={editing === "new" ? `${addLabel}` : `Edit ${title.toLowerCase().replace(/s$/, "")}`}
          fields={editing === "new" ? fields : fields.map((f) => (f.type === "password" ? { ...f, required: false, optional: true } : f))}
          initial={editing === "new" ? defaults : (toForm ?? ((r: T) => r))(editing)}
          id={editing === "new" ? undefined : editing._id}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
