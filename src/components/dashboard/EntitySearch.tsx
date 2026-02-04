"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEntities } from "@/hooks/useEntities";
import type { EntityMentionParams } from "@/lib/types";

const SORT_OPTIONS: {
  label: string;
  value: EntityMentionParams["sortBy"];
}[] = [
  { label: "Mentions", value: "total_mentions" },
  { label: "Documents", value: "unique_documents" },
  { label: "Name", value: "canonical_name" },
];

export function EntitySearch() {
  const [searchInput, setSearchInput] = useState("");
  const { data, count, loading, params, updateParams } = useEntities();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      updateParams({ search: searchInput || undefined, offset: 0 });
    },
    [searchInput, updateParams]
  );

  const handleSort = useCallback(
    (sortBy: EntityMentionParams["sortBy"]) => {
      if (params.sortBy === sortBy) {
        updateParams({
          sortOrder: params.sortOrder === "desc" ? "asc" : "desc",
        });
      } else {
        updateParams({ sortBy, sortOrder: "desc" });
      }
    },
    [params, updateParams]
  );

  const page = Math.floor((params.offset || 0) / (params.limit || 25)) + 1;
  const totalPages = Math.ceil(count / (params.limit || 25));

  return (
    <Card className="paper-grain border-border bg-card" id="entities">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-xl font-bold">
            Entity Index
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {count.toLocaleString()} entities
          </span>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 bg-muted/30 pl-9 text-sm"
            />
          </form>
          <div className="flex gap-1">
            {SORT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={params.sortBy === opt.value ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => handleSort(opt.value)}
              >
                {opt.label}
                {params.sortBy === opt.value && (
                  <ArrowUpDown className="h-3 w-3" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_100px_140px] gap-2 border-b border-border px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Entity</span>
          <span className="text-right">Mentions</span>
          <span className="text-right">Documents</span>
          <span className="text-right">Type</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_100px_100px_140px] gap-2 border-b border-border/50 px-5 py-3"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-12" />
                <Skeleton className="ml-auto h-4 w-10" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No entities found.
          </div>
        ) : (
          <div>
            {data.map((entity, idx) => (
              <Link
                key={entity.entity_id}
                href={`/entity/${entity.entity_id}`}
                className="grid grid-cols-[1fr_100px_100px_140px] gap-2 border-b border-border/50 px-5 py-3 transition-colors hover:bg-muted/20"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    {entity.canonical_name}
                  </span>
                  {entity.aliases && entity.aliases.length > 0 && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      aka {entity.aliases.slice(0, 3).join(", ")}
                      {entity.aliases.length > 3 &&
                        ` +${entity.aliases.length - 3}`}
                    </p>
                  )}
                </div>
                <span className="self-center text-right font-mono text-sm text-gold tabular-nums">
                  {entity.total_mentions.toLocaleString()}
                </span>
                <span className="self-center text-right font-mono text-sm text-muted-foreground tabular-nums">
                  {entity.unique_documents.toLocaleString()}
                </span>
                <div className="flex items-center justify-end">
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {entity.entity_type}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() =>
                  updateParams({
                    offset: ((page - 2) * (params.limit || 25)),
                  })
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() =>
                  updateParams({
                    offset: (page * (params.limit || 25)),
                  })
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
