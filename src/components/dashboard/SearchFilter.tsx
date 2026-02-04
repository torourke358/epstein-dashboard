"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getDistinctDocTypes } from "@/lib/queries";

// ── Helpers ─────────────────────────────────────────────────────────

function formatDocType(dt: string): string {
  return dt
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Types ───────────────────────────────────────────────────────────

interface SearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedDocType: string | null;
  onDocTypeChange: (docType: string | null) => void;
}

// ── Component ───────────────────────────────────────────────────────

export function SearchFilter({
  searchQuery,
  onSearchChange,
  selectedDocType,
  onDocTypeChange,
}: SearchFilterProps) {
  const [docTypes, setDocTypes] = useState<string[]>([]);

  useEffect(() => {
    getDistinctDocTypes().then(setDocTypes).catch(console.error);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search box */}
      <div className="relative min-w-[220px] flex-1 max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search names across all visualizations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 bg-muted/30 pl-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Doc type filter chips */}
      {docTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
            Doc Type:
          </span>
          {selectedDocType && (
            <button
              onClick={() => onDocTypeChange(null)}
              className="flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold transition-colors hover:bg-gold/20"
            >
              {formatDocType(selectedDocType)}
              <X className="h-3 w-3" />
            </button>
          )}
          {!selectedDocType &&
            docTypes.slice(0, 6).map((dt) => (
              <button
                key={dt}
                onClick={() => onDocTypeChange(dt)}
                className="rounded-full border border-border/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gold/30 hover:text-foreground"
              >
                {formatDocType(dt)}
              </button>
            ))}
          {!selectedDocType && docTypes.length > 6 && (
            <span className="text-[10px] text-muted-foreground">
              +{docTypes.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
