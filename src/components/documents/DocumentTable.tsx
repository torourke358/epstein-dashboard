"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  ChevronsUpDown,
  FileText,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocuments } from "@/hooks/useDocuments";
import {
  getDistinctSections,
  getDistinctDocTypes,
  getDocumentTextPreview,
  getDocumentEntities,
} from "@/lib/queries";
import type { Document, DocumentTextPreview, DocumentEntityRow } from "@/lib/types";

// ── Constants ───────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<string, string> = {
  discovered: "bg-blue-900/30 text-blue-400 border-blue-800",
  downloaded: "bg-purple-900/30 text-purple-400 border-purple-800",
  extracted: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  processed: "bg-gold/10 text-gold border-gold/30",
  failed: "bg-red-900/30 text-red-400 border-red-800",
};

const STATUSES = ["discovered", "downloaded", "extracted", "processed", "failed"];

type SortableCol = "filename" | "section" | "doc_type" | "page_count" | "text_length";

// ── Helpers ─────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function exportCSV(rows: Document[]) {
  const headers = [
    "filename",
    "section",
    "doc_type",
    "page_count",
    "text_length",
    "file_size_bytes",
    "is_ocr",
    "status",
    "url",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escape(r.filename),
        escape(r.section || ""),
        escape(r.doc_type || ""),
        r.page_count ?? "",
        r.text_length ?? "",
        r.file_size_bytes ?? "",
        r.is_ocr ?? "",
        r.status,
        escape(r.url || ""),
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "epstein-documents.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Sort header ─────────────────────────────────────────────────────

function SortHeader({
  label,
  col,
  currentSort,
  currentOrder,
  onSort,
  className,
}: {
  label: string;
  col: SortableCol;
  currentSort?: string;
  currentOrder?: string;
  onSort: (col: SortableCol) => void;
  className?: string;
}) {
  const active = currentSort === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 hover:text-foreground transition-colors ${className || ""}`}
    >
      {label}
      {active ? (
        currentOrder === "asc" ? (
          <ChevronUp className="h-3 w-3 text-gold" />
        ) : (
          <ChevronDown className="h-3 w-3 text-gold" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

// ── Expandable row ──────────────────────────────────────────────────

function ExpandedRow({ doc }: { doc: Document }) {
  const [preview, setPreview] = useState<DocumentTextPreview | null>(null);
  const [entities, setEntities] = useState<DocumentEntityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDocumentTextPreview(doc.id),
      getDocumentEntities(doc.id),
    ]).then(([text, ents]) => {
      if (cancelled) return;
      setPreview(text);
      setEntities(ents);
    }).catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc.id]);

  if (loading) {
    return (
      <div className="border-b border-border/30 bg-muted/5 px-5 py-4 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  return (
    <div className="border-b border-border/30 bg-muted/5 px-5 py-4 space-y-3">
      {/* Text preview */}
      {preview?.text ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Text Preview
          </p>
          <p className="text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">
            {preview.text}
            {preview.text.length >= 500 && (
              <span className="text-muted-foreground">&hellip;</span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          No extracted text available.
        </p>
      )}

      {/* Entities */}
      {entities.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            Entities mentioned ({entities.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entities.slice(0, 30).map((e) => (
              <Link key={e.entity_id} href={`/entity/${e.entity_id}`}>
                <Badge
                  variant="secondary"
                  className="text-[10px] hover:bg-gold/20 cursor-pointer transition-colors"
                >
                  {e.canonical_name}
                  <span className="ml-1 text-muted-foreground">
                    ({e.mention_count})
                  </span>
                </Badge>
              </Link>
            ))}
            {entities.length > 30 && (
              <Badge variant="outline" className="text-[10px]">
                +{entities.length - 30} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* PDF link */}
      {doc.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold/80 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View original PDF on DOJ site
        </a>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function DocumentTable() {
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { data, count, loading, params, updateParams } = useDocuments({
    limit: PAGE_SIZE,
  });

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filter options
  const [sections, setSections] = useState<string[]>([]);
  const [docTypes, setDocTypes] = useState<string[]>([]);

  useEffect(() => {
    getDistinctSections().then(setSections).catch(console.error);
    getDistinctDocTypes().then(setDocTypes).catch(console.error);
  }, []);

  // Debounced search
  const handleSearchChange = useCallback(
    (val: string) => {
      setSearchInput(val);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        updateParams({ search: val || undefined, offset: 0 });
      }, 300);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (col: SortableCol) => {
      if (params.sortBy === col) {
        updateParams({
          sortOrder: params.sortOrder === "asc" ? "desc" : "asc",
          offset: 0,
        });
      } else {
        updateParams({ sortBy: col, sortOrder: "asc", offset: 0 });
      }
    },
    [params.sortBy, params.sortOrder, updateParams]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const page = Math.floor((params.offset || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-xl font-bold">
            Document Explorer
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {count.toLocaleString()} documents
            </span>
            <button
              onClick={() => exportCSV(data)}
              className="flex items-center gap-1 rounded-md border border-border/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Export filtered results as CSV"
            >
              <Download className="h-3 w-3" />
              CSV
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search filenames..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 w-full rounded-md border border-border/50 bg-muted/20 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50"
            />
          </div>

          {/* Section dropdown */}
          <select
            value={params.section || ""}
            onChange={(e) =>
              updateParams({
                section: e.target.value || undefined,
                offset: 0,
              })
            }
            className="chart-select h-8 rounded-md border border-border/50 bg-muted/20 px-2 pr-7 text-xs text-foreground"
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s.replace("/epstein/", "")}
              </option>
            ))}
          </select>

          {/* Doc type dropdown */}
          <select
            value={params.docType || ""}
            onChange={(e) =>
              updateParams({
                docType: e.target.value || undefined,
                offset: 0,
              })
            }
            className="chart-select h-8 rounded-md border border-border/50 bg-muted/20 px-2 pr-7 text-xs text-foreground"
          >
            <option value="">All doc types</option>
            {docTypes.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Status dropdown */}
          <select
            value={params.status || ""}
            onChange={(e) =>
              updateParams({
                status: e.target.value || undefined,
                offset: 0,
              })
            }
            className="chart-select h-8 rounded-md border border-border/50 bg-muted/20 px-2 pr-7 text-xs text-foreground"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* OCR toggle */}
          <button
            onClick={() =>
              updateParams({
                isOcr:
                  params.isOcr === true
                    ? undefined
                    : true,
                offset: 0,
              })
            }
            className={`h-8 rounded-md border px-2.5 text-xs transition-colors ${
              params.isOcr === true
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            OCR only
          </button>

          {/* Has mentions toggle */}
          <button
            onClick={() =>
              updateParams({
                hasMentions:
                  params.hasMentions === true
                    ? undefined
                    : true,
                offset: 0,
              })
            }
            className={`h-8 rounded-md border px-2.5 text-xs transition-colors ${
              params.hasMentions === true
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            Has mentions
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_120px_100px_80px_80px_90px] gap-2 border-b border-border px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <SortHeader
            label="Filename"
            col="filename"
            currentSort={params.sortBy}
            currentOrder={params.sortOrder}
            onSort={handleSort}
          />
          <SortHeader
            label="Section"
            col="section"
            currentSort={params.sortBy}
            currentOrder={params.sortOrder}
            onSort={handleSort}
          />
          <SortHeader
            label="Doc Type"
            col="doc_type"
            currentSort={params.sortBy}
            currentOrder={params.sortOrder}
            onSort={handleSort}
          />
          <SortHeader
            label="Pages"
            col="page_count"
            currentSort={params.sortBy}
            currentOrder={params.sortOrder}
            onSort={handleSort}
            className="justify-end"
          />
          <SortHeader
            label="Text"
            col="text_length"
            currentSort={params.sortBy}
            currentOrder={params.sortOrder}
            onSort={handleSort}
            className="justify-end"
          />
          <span className="text-right">Status</span>
        </div>

        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_120px_100px_80px_80px_90px] gap-2 border-b border-border/50 px-5 py-3"
              >
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="ml-auto h-4 w-8" />
                <Skeleton className="ml-auto h-4 w-12" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No documents found.
          </div>
        ) : (
          <div>
            {data.map((doc) => {
              const expanded = expandedIds.has(doc.id);
              return (
                <div key={doc.id}>
                  <div
                    onClick={() => toggleExpand(doc.id)}
                    className={`grid grid-cols-[1fr_120px_100px_80px_80px_90px] gap-2 border-b border-border/50 px-5 py-3 transition-colors cursor-pointer hover:bg-muted/20 ${
                      expanded ? "bg-muted/10" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {expanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0 text-gold" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm text-foreground">
                        {doc.filename}
                      </span>
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-gold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <span className="self-center truncate text-xs text-muted-foreground">
                      {doc.section?.replace("/epstein/", "") || "--"}
                    </span>
                    <span className="self-center truncate text-xs text-muted-foreground">
                      {doc.doc_type || "--"}
                    </span>
                    <span className="self-center text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {doc.page_count ?? "--"}
                    </span>
                    <span className="self-center text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {doc.text_length != null
                        ? doc.text_length > 1000
                          ? `${(doc.text_length / 1000).toFixed(0)}k`
                          : String(doc.text_length)
                        : "--"}
                    </span>
                    <div className="flex items-center justify-end">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-normal ${STATUS_COLORS[doc.status] || ""}`}
                      >
                        {doc.status}
                      </Badge>
                    </div>
                  </div>
                  {expanded && <ExpandedRow doc={doc} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() =>
                  updateParams({ offset: (page - 2) * PAGE_SIZE })
                }
                className="rounded border border-border/50 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => updateParams({ offset: page * PAGE_SIZE })}
                className="rounded border border-border/50 p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
