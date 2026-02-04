"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityCoMentions } from "@/lib/queries";

// ── Types ───────────────────────────────────────────────────────────

interface CoMentionRow {
  entity_id: string;
  entity_name: string;
  shared_documents: number;
  co_occurrences: number;
}

// ── Component ──────────────────────────────────────────────────────

export function CoMentionsTab({ entityId }: { entityId: string }) {
  const [rows, setRows] = useState<CoMentionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEntityCoMentions(entityId)
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No co-mentioned entities found.
      </p>
    );
  }

  const maxCo = Math.max(...rows.map((r) => r.co_occurrences), 1);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {rows.length} entities appear alongside this entity in the same
        documents
      </p>

      <div className="overflow-x-auto rounded border border-border/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/10">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Entity
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Shared Documents
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Co-occurrences
              </th>
              <th className="px-3 py-2 font-medium text-muted-foreground w-32">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.entity_id}
                className="border-t border-border/20 transition-colors hover:bg-muted/5"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/entity/${row.entity_id}`}
                    className="text-foreground hover:text-gold transition-colors font-medium"
                  >
                    {row.entity_name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.shared_documents}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gold font-medium">
                  {row.co_occurrences}
                </td>
                <td className="px-3 py-2">
                  <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold/60"
                      style={{
                        width: `${(row.co_occurrences / maxCo) * 100}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
