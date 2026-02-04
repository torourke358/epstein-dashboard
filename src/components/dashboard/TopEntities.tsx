"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchEntityChartData } from "@/lib/queries";
import type { EntityMentionCount } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────

interface TopEntitiesProps {
  selectedEntityId?: string | null;
  onSelectEntity?: (id: string | null) => void;
  selectedDocType?: string | null;
}

type SortCol = "total_mentions" | "canonical_name";

// ── Component ───────────────────────────────────────────────────────

export const TopEntities = memo(function TopEntities({
  selectedEntityId,
  onSelectEntity,
  selectedDocType,
}: TopEntitiesProps) {
  const router = useRouter();
  const [entities, setEntities] = useState<EntityMentionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("total_mentions");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ── Fetch top 30 entities ───────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetchEntityChartData({
      sortBy: sortCol,
      sortOrder,
      limit: 30,
      offset: 0,
    })
      .then(({ data }) => setEntities(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sortCol, sortOrder]);

  // ── Local search filter ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = entities;
    if (searchInput.trim()) {
      const term = searchInput.toLowerCase();
      list = list.filter((e) =>
        e.canonical_name.toLowerCase().includes(term)
      );
    }
    return list;
  }, [entities, searchInput]);

  const maxMentions = useMemo(
    () => Math.max(1, ...filtered.map((e) => e.total_mentions)),
    [filtered]
  );

  // ── Sort toggle ─────────────────────────────────────────────────
  const handleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) {
        setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      } else {
        setSortCol(col);
        setSortOrder(col === "total_mentions" ? "desc" : "asc");
      }
    },
    [sortCol]
  );

  // ── Row click ───────────────────────────────────────────────────
  const handleRowClick = useCallback(
    (entity: EntityMentionCount) => {
      if (onSelectEntity) {
        onSelectEntity(
          selectedEntityId === entity.entity_id ? null : entity.entity_id
        );
      } else {
        router.push(`/entity/${entity.entity_id}`);
      }
    },
    [onSelectEntity, selectedEntityId, router]
  );

  // ── Loading skeleton ────────────────────────────────────────────
  if (loading && entities.length === 0) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-9 w-full" />
        </CardHeader>
        <CardContent className="space-y-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="paper-grain border-border bg-card flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-xl font-bold">
          Top Mentioned <span className="text-gold-gradient">Names</span>
        </CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Click a name to highlight in network graph and heatmap
        </p>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search names..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 bg-muted/30 pl-8 text-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        {/* Column headers */}
        <div className="flex items-center border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="w-8 shrink-0 text-center">#</div>
          <button
            onClick={() => handleSort("canonical_name")}
            className="flex flex-1 items-center gap-1 text-left transition-colors hover:text-foreground"
          >
            Name
            {sortCol === "canonical_name" && (
              <ArrowUpDown className="h-3 w-3" />
            )}
          </button>
          <div className="w-[140px] shrink-0 px-2">Frequency</div>
          <button
            onClick={() => handleSort("total_mentions")}
            className="flex w-[72px] shrink-0 items-center justify-end gap-1 transition-colors hover:text-foreground"
          >
            Count
            {sortCol === "total_mentions" && (
              <ArrowUpDown className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Entity rows */}
        <div className="max-h-[640px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No entities match your search.
            </div>
          ) : (
            filtered.map((entity, idx) => {
              const barPct = (entity.total_mentions / maxMentions) * 100;
              const isSelected = selectedEntityId === entity.entity_id;
              const rank = idx + 1;

              return (
                <div
                  key={entity.entity_id}
                  className={`flex cursor-pointer items-center px-4 py-2 transition-colors ${
                    isSelected
                      ? "bg-gold/10 border-l-2 border-l-gold"
                      : idx % 2 === 0
                        ? "bg-transparent hover:bg-muted/10"
                        : "bg-muted/5 hover:bg-muted/15"
                  }`}
                  onClick={() => handleRowClick(entity)}
                >
                  {/* Rank */}
                  <div className="w-8 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {rank}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0 pr-2">
                    <span
                      className={`text-sm font-medium truncate block ${
                        isSelected ? "text-gold" : "text-foreground"
                      }`}
                      title={entity.canonical_name}
                    >
                      {entity.canonical_name}
                    </span>
                    {entity.entity_type && (
                      <span className="text-[10px] text-muted-foreground">
                        {entity.entity_type}
                      </span>
                    )}
                  </div>

                  {/* Bar */}
                  <div className="w-[140px] shrink-0 px-2">
                    <div className="h-[14px] w-full rounded-sm bg-muted/20 overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all duration-300"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: isSelected ? "#D4A843" : "#4a6a8a",
                          minWidth: barPct > 0 ? 2 : 0,
                        }}
                      />
                    </div>
                  </div>

                  {/* Count */}
                  <div className="w-[72px] shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {entity.total_mentions.toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
});
