"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityDocuments } from "@/lib/queries";
import type { EntityDocument } from "@/lib/types";

// ── Component ──────────────────────────────────────────────────────

export function DocumentsTab({ entityId }: { entityId: string }) {
  const [documents, setDocuments] = useState<EntityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"mention_count" | "filename">(
    "mention_count"
  );
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    setLoading(true);
    getEntityDocuments(entityId)
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  const sorted = [...documents].sort((a, b) => {
    if (sortBy === "mention_count") {
      return sortAsc
        ? a.mention_count - b.mention_count
        : b.mention_count - a.mention_count;
    }
    return sortAsc
      ? a.filename.localeCompare(b.filename)
      : b.filename.localeCompare(a.filename);
  });

  const toggleSort = (col: "mention_count" | "filename") => {
    if (sortBy === col) setSortAsc((p) => !p);
    else {
      setSortBy(col);
      setSortAsc(col === "filename");
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No documents found for this entity.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {documents.length} documents mentioning this entity
      </p>

      <div className="overflow-x-auto rounded border border-border/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/10">
              <th
                className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("filename")}
              >
                Filename{" "}
                {sortBy === "filename" && (sortAsc ? "\u2191" : "\u2193")}
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Section
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Type
              </th>
              <th
                className="px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => toggleSort("mention_count")}
              >
                Mentions{" "}
                {sortBy === "mention_count" && (sortAsc ? "\u2191" : "\u2193")}
              </th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((doc) => (
              <tr
                key={doc.document_id}
                className="border-t border-border/20 transition-colors hover:bg-muted/5"
              >
                <td className="px-3 py-2 text-foreground max-w-[300px] truncate">
                  {doc.filename}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {doc.section}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {doc.doc_type && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {doc.doc_type}
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gold font-medium">
                  {doc.mention_count}
                </td>
                <td className="px-3 py-2 text-center">
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-muted-foreground hover:text-gold transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
