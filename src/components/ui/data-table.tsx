"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Rows3, Rows4, Search, X } from "lucide-react";
import { useUrlState, urlNumber } from "@/lib/hooks/useUrlState";
import { Button, EmptyState, Input, Select, cn } from "./index";
import { SegmentedControl } from "./segmented";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Right-aligned with tabular figures, header included. */
    numeric?: boolean;
    /** Label shown before the value in the stacked (narrow) layout; defaults to the header string. */
    label?: string;
    /** The row's title in the stacked layout (shown without a label, in bold). */
    primary?: boolean;
    className?: string;
  }
}

/* Density is a per-viewer convenience, remembered in localStorage across tables. */
type Density = "comfortable" | "compact";
const DENSITY_KEY = "table-density";
const densityListeners = new Set<() => void>();
function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}
function writeDensity(d: Density) {
  try {
    localStorage.setItem(DENSITY_KEY, d);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  densityListeners.forEach((l) => l());
}
function subscribeDensity(cb: () => void) {
  densityListeners.add(cb);
  return () => densityListeners.delete(cb);
}

export interface DataTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  /** Accessible name for the scrollable region. */
  label: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Enables pagination with this many rows per page. */
  pageSize?: number;
  /** Prefix for the URL params (`sort`, `q`, `page`) when a page has more than one table. */
  urlKey?: string;
  initialSort?: SortingState;
  /** Extra filters, rendered next to the search box. */
  toolbar?: ReactNode;
  /** Export buttons or menu, rendered at the end of the toolbar. */
  exportSlot?: ReactNode;
  /** Shown when `data` is empty (as opposed to filtered to nothing). */
  empty?: ReactNode;
  getRowId?: (row: T, index: number) => string;
  stickyFirstColumn?: boolean;
  /** Makes the header stick while the body scrolls. */
  maxHeight?: string;
  /** Switch to stacked cards when the table's container is narrower than 40rem. */
  stackOnNarrow?: boolean;
  showDensity?: boolean;
  className?: string;
}

function encodeSort(s: SortingState) {
  return s.map((c) => `${c.id}.${c.desc ? "desc" : "asc"}`).join(",");
}
function decodeSort(raw: string): SortingState {
  return raw
    .split(",")
    .filter(Boolean)
    .map((part) => {
      const [id, dir] = part.split(".");
      return { id, desc: dir === "desc" };
    });
}

/**
 * Sortable, searchable table on TanStack Table, with sort/search/page in the URL so a reload or a
 * shared link keeps the view. Headers carry aria-sort; numeric columns are right-aligned
 * (GOV.UK table guidance); narrow containers get stacked cards with per-cell labels.
 */
export function DataTable<T>({
  data,
  columns,
  label,
  searchable = false,
  searchPlaceholder,
  pageSize,
  urlKey = "",
  initialSort = [],
  toolbar,
  exportSlot,
  empty,
  getRowId,
  stickyFirstColumn = false,
  maxHeight,
  stackOnNarrow = true,
  showDensity = false,
  className,
}: DataTableProps<T>) {
  const t = useTranslations("table");
  const tc = useTranslations("common");
  const defaultSort = useMemo(() => encodeSort(initialSort), [initialSort]);
  const [sortParam, setSortParam] = useUrlState(`${urlKey}sort`, defaultSort);
  const [query, setQuery] = useUrlState(`${urlKey}q`, "");
  const [page, setPage] = useUrlState(`${urlKey}page`, 1, urlNumber);
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => "comfortable" as const);

  const sorting = useMemo(() => decodeSort(sortParam), [sortParam]);
  const pageIndex = Math.max(0, page - 1);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack returns a stable instance with fresh state each render
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, globalFilter: query, ...(pageSize ? { pagination: { pageIndex, pageSize } } : {}) },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSortParam(encodeSort(next));
    },
    onGlobalFilterChange: (value) => {
      setQuery(String(value ?? ""));
      if (pageSize) setPage(1);
    },
    onPaginationChange: (updater) => {
      if (!pageSize) return;
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPage(next.pageIndex + 1);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    autoResetPageIndex: false,
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const compact = density === "compact";
  const cellPad = compact ? "py-1.5" : "py-2.5";

  // In the stacked (narrow) layout the header row is hidden, so sorting moves into a select.
  const sortable = table.getAllLeafColumns().filter((c) => c.getCanSort());
  const sortValue = sorting[0] ? `${sorting[0].id}.${sorting[0].desc ? "desc" : "asc"}` : "";
  const columnLabel = (id: string) => {
    const c = table.getColumn(id)?.columnDef;
    return c?.meta?.label ?? (typeof c?.header === "string" ? c.header : id);
  };
  const hasToolbar = searchable || toolbar || exportSlot || showDensity || (stackOnNarrow && sortable.length > 0);

  return (
    <div className={cn("ui-dt-wrap", className)}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          {searchable && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder ?? t("searchPlaceholder")}
                aria-label={searchPlaceholder ?? tc("search")}
                className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => table.setGlobalFilter("")}
                  aria-label={tc("clearSearch")}
                  className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {toolbar}
          {stackOnNarrow && sortable.length > 0 && (
            <Select
              value={sortValue}
              onChange={(e) => setSortParam(e.target.value)}
              aria-label={t("sortLabel")}
              className="hidden @max-[40rem]:block"
            >
              <option value="">{t("sortDefault")}</option>
              {sortable.flatMap((c) => [
                <option key={`${c.id}.asc`} value={`${c.id}.asc`}>
                  {t("sortOption", { column: columnLabel(c.id), direction: t("ascending") })}
                </option>,
                <option key={`${c.id}.desc`} value={`${c.id}.desc`}>
                  {t("sortOption", { column: columnLabel(c.id), direction: t("descending") })}
                </option>,
              ])}
            </Select>
          )}
          <div className="ml-auto flex items-center gap-2">
            {showDensity && (
              <SegmentedControl
                size="sm"
                label={t("density")}
                value={density}
                onChange={writeDensity}
                options={[
                  { value: "comfortable", label: <span className="sr-only">{t("comfortable")}</span>, icon: <Rows3 aria-hidden /> },
                  { value: "compact", label: <span className="sr-only">{t("compact")}</span>, icon: <Rows4 aria-hidden /> },
                ]}
              />
            )}
            {exportSlot}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="p-5">{empty ?? <EmptyState title={t("empty")} />}</div>
      ) : filteredCount === 0 ? (
        <div className="p-5">
          <EmptyState
            title={tc("noResults")}
            description={t("emptyFiltered")}
            action={
              <Button variant="secondary" size="sm" onClick={() => table.setGlobalFilter("")}>
                {tc("clearSearch")}
              </Button>
            }
          />
        </div>
      ) : (
        <div
          className={cn("ui-scroll-x", maxHeight && "overflow-y-auto")}
          style={maxHeight ? { maxHeight } : undefined}
          role="region"
          aria-label={label}
          tabIndex={0}
        >
          <table role="table" className={cn("ui-dt w-full border-separate border-spacing-0 text-sm", stackOnNarrow && "ui-dt-stack")}>
            <thead role="rowgroup">
              {table.getHeaderGroups().map((hg) => (
                <tr role="row" key={hg.id}>
                  {hg.headers.map((header, i) => {
                    const meta = header.column.columnDef.meta;
                    const sorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    const content = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
                    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                    return (
                      <th
                        role="columnheader"
                        key={header.id}
                        scope="col"
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                        className={cn(
                          "border-b border-border bg-surface-2 px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5",
                          maxHeight && "sticky top-0 z-10",
                          stickyFirstColumn && i === 0 && "sticky left-0 z-20",
                          meta?.numeric && "text-right",
                          meta?.className,
                        )}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "group -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground",
                              "focus-visible:outline-2 focus-visible:outline-brand",
                              meta?.numeric && "flex-row-reverse",
                              sorted && "text-foreground",
                            )}
                          >
                            {content}
                            <Icon
                              aria-hidden
                              className={cn("size-3.5 shrink-0", !sorted && "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60")}
                            />
                          </button>
                        ) : (
                          content
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody role="rowgroup">
              {rows.map((row) => (
                <tr role="row" key={row.id} className="group/row">
                  {row.getVisibleCells().map((cell, i) => {
                    const meta = cell.column.columnDef.meta;
                    const header = cell.column.columnDef.header;
                    return (
                      <td
                        role="cell"
                        key={cell.id}
                        data-label={meta?.label ?? (typeof header === "string" ? header : undefined)}
                        data-primary={meta?.primary || undefined}
                        className={cn(
                          "border-b border-border px-3 align-middle first:pl-5 last:pr-5 group-last/row:border-b-0 group-hover/row:bg-surface-2/60",
                          cellPad,
                          stickyFirstColumn && i === 0 && "sticky left-0 z-[1] bg-surface",
                          meta?.numeric && "text-right tabular",
                          meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageSize && filteredCount > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5 text-sm text-muted">
          <span className="tabular" aria-live="polite">
            {t("showing", {
              from: pageIndex * pageSize + 1,
              to: Math.min(filteredCount, (pageIndex + 1) * pageSize),
              total: filteredCount,
            })}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label={t("previous")}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label={t("next")}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
