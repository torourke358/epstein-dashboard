"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getContextSnippets } from "@/lib/queries";
import type { ContextSnippet } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const EXTRACTION_COLORS: Record<string, string> = {
  regex: "bg-blue-900/40 text-blue-300",
  spacy: "bg-purple-900/40 text-purple-300",
  claude: "bg-amber-900/40 text-amber-300",
};

// ── Helpers ────────────────────────────────────────────────────────

function highlightEntity(
  text: string,
  terms: string[]
): React.ReactNode {
  const valid = terms.filter(Boolean);
  if (!valid.length || !text) return text;
  const pattern = valid
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="bg-transparent text-gold font-semibold"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ── Component ──────────────────────────────────────────────────────

export function ContextSnippetsTab({
  entityId,
  entityName,
  entityAliases,
  sections,
  docTypes,
}: {
  entityId: string;
  entityName: string;
  entityAliases: string[];
  sections: string[];
  docTypes: string[];
}) {
  const [snippets, setSnippets] = useState<ContextSnippet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSection, setFilterSection] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
    }, 300);
  }, []);

  // Fetch
  useEffect(() => {
    setLoading(true);
    getContextSnippets(entityId, {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      section: filterSection || undefined,
      docType: filterDocType || undefined,
      extractionMethod: filterMethod || undefined,
      search: search || undefined,
    })
      .then(({ data, count }) => {
        setSnippets(data);
        setTotal(count);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId, page, filterSection, filterDocType, filterMethod, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const highlightTerms = [entityName, ...entityAliases];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search snippets..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 rounded-md border border-border/50 bg-muted/20 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold/50 w-48"
          />
        </div>
        <select
          value={filterSection}
          onChange={(e) => {
            setFilterSection(e.target.value);
            setPage(0);
          }}
          className="chart-select h-8 rounded-md border border-border/50 bg-muted/20 px-2 pr-7 text-xs text-foreground"
        >
          <option value="">All sections</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterDocType}
          onChange={(e) => {
            setFilterDocType(e.target.value);
            setPage(0);
          }}
          className="chart-select h-8 rounded-md border border-border/50 bg-muted/20 px-2 pr-7 text-xs text-foreground"
        >
          <option value="">All doc types</option>
          {docTypes.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={filterMethod}
          onChange={(e) => {
            setFilterMethod(e.target.value);
            setPage(0);
          }}
          className="chart-select h-8 rounded-md border border-border/50 bg-muted/20 px-2 pr-7 text-xs text-foreground"
        >
          <option value="">All methods</option>
          <option value="regex">regex</option>
          <option value="spacy">spacy</option>
          <option value="claude">claude</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">
          {total.toLocaleString()} results
        </span>
      </div>

      {/* Snippet list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : snippets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No context snippets found.
        </p>
      ) : (
        <div className="space-y-3">
          {snippets.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-border/40 bg-muted/5 p-3 space-y-2"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-center gap-2">
                {s.document_url ? (
                  <a
                    href={s.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-foreground hover:text-gold transition-colors flex items-center gap-1"
                  >
                    {s.document_filename || "Document"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs font-medium text-foreground">
                    {s.document_filename || "Document"}
                  </span>
                )}
                {s.page_number != null && (
                  <span className="text-[10px] text-muted-foreground">
                    p. {s.page_number}
                  </span>
                )}
                {s.document_doc_type && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {s.document_doc_type}
                  </Badge>
                )}
                {s.document_section && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {s.document_section}
                  </Badge>
                )}
                <Badge
                  className={`text-[10px] px-1.5 py-0 border-0 ${
                    EXTRACTION_COLORS[s.extraction_method] ||
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.extraction_method}
                </Badge>
                {s.confidence != null && (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {(s.confidence * 100).toFixed(0)}% conf
                  </span>
                )}
              </div>

              {/* Snippet text */}
              <p className="text-sm leading-relaxed text-foreground/80">
                &ldquo;
                {highlightEntity(
                  s.context_snippet || s.raw_text,
                  highlightTerms
                )}
                &rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-border/50 px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded border border-border/50 px-3 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
