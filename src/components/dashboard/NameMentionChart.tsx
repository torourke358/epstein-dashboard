"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchEntityChartData,
  getEntitySectionBreakdown,
  getDistinctSections,
} from "@/lib/queries";
import type { EntityMentionCount, SectionBreakdown } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────

const PAGE_SIZE = 100;
const ROW_HEIGHT = 32;
const VISIBLE_ROWS = 25;
const CHART_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

// ── Section helpers ────────────────────────────────────────────────

function getSectionColor(raw: string): string {
  const key = raw.toLowerCase().replace(/^\/epstein\//, "").replace(/\/$/, "");
  if (key.includes("court")) return "#D4A843";
  if (key.includes("doj") || key.includes("disclosure")) return "#4a8bc2";
  if (key.includes("foia")) return "#5b8a72";
  if (key.includes("house") || key.includes("oversight")) return "#7c6e9b";
  return "#8892a4";
}

function cleanSectionLabel(raw: string): string {
  return (
    raw
      .replace(/^\/epstein\//, "")
      .replace(/\/$/, "")
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Other"
  );
}

// ── Hooks ──────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── CSV export ─────────────────────────────────────────────────────

function exportCSV(entities: EntityMentionCount[]) {
  const header =
    "Entity,Type,Total Mentions,Unique Documents,Sections,Doc Types\n";
  const rows = entities
    .map(
      (e) =>
        `"${e.canonical_name.replace(/"/g, '""')}","${e.entity_type}",${
          e.total_mentions
        },${e.unique_documents},"${(e.sections || [])
          .map(cleanSectionLabel)
          .join("; ")}","${(e.doc_types || []).join("; ")}"`
    )
    .join("\n");

  const blob = new Blob([header + rows], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `entity-mentions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Sort presets ───────────────────────────────────────────────────

type SortPreset = {
  label: string;
  sortBy: "total_mentions" | "unique_documents" | "canonical_name";
  sortOrder: "asc" | "desc";
};

const SORT_PRESETS: SortPreset[] = [
  { label: "Most Mentions", sortBy: "total_mentions", sortOrder: "desc" },
  { label: "Most Documents", sortBy: "unique_documents", sortOrder: "desc" },
  { label: "Name (A\u2013Z)", sortBy: "canonical_name", sortOrder: "asc" },
];

// ── Section legend ─────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { label: "Court Records", color: "#D4A843" },
  { label: "DOJ Disclosures", color: "#4a8bc2" },
  { label: "FOIA", color: "#5b8a72" },
  { label: "House Oversight", color: "#7c6e9b" },
  { label: "Other", color: "#8892a4" },
];

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export const NameMentionChart = memo(function NameMentionChart() {
  const router = useRouter();

  // ── Entity data ─────────────────────────────────────────────────
  const [entities, setEntities] = useState<EntityMentionCount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unfilteredCount, setUnfilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ── Section breakdowns (lazy-loaded, cached) ────────────────────
  const breakdownCacheRef = useRef(new Map<string, SectionBreakdown[]>());
  const pendingRef = useRef(new Set<string>());
  const [breakdownVersion, setBreakdownVersion] = useState(0);

  // ── Available sections for filter dropdown ──────────────────────
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  // ── Filter state ────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [sortPresetIdx, setSortPresetIdx] = useState(0);
  const [minMentions, setMinMentions] = useState(5);
  const debouncedMinMentions = useDebounce(minMentions, 300);
  const [sectionFilter, setSectionFilter] = useState("");

  // ── Tooltip ─────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{
    entity: EntityMentionCount;
    breakdown: SectionBreakdown[] | null;
    x: number;
    y: number;
  } | null>(null);

  // ── Refs ────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const filterVersionRef = useRef(0);

  // ── Derived sort values ─────────────────────────────────────────
  const { sortBy, sortOrder } = SORT_PRESETS[sortPresetIdx];

  // ── Fetch sections + unfiltered count once on mount ─────────────
  useEffect(() => {
    fetchEntityChartData({ limit: 1, offset: 0 })
      .then(({ count }) => setUnfilteredCount(count))
      .catch(console.error);
    getDistinctSections().then(setAvailableSections).catch(console.error);
  }, []);

  // ── Fetch data (resets on filter change) ────────────────────────
  const fetchData = useCallback(async () => {
    filterVersionRef.current++;
    const v = filterVersionRef.current;
    setLoading(true);
    setHasMore(true);

    try {
      const { data, count } = await fetchEntityChartData({
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        minMentions:
          debouncedMinMentions > 0 ? debouncedMinMentions : undefined,
        section: sectionFilter || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (filterVersionRef.current !== v) return;
      setEntities(data);
      setTotalCount(count);
      setHasMore(data.length < count);
    } catch (err) {
      if (filterVersionRef.current === v) {
        console.error("Failed to fetch entities:", err);
      }
    } finally {
      if (filterVersionRef.current === v) setLoading(false);
    }
  }, [debouncedSearch, sortBy, sortOrder, debouncedMinMentions, sectionFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Load more (infinite scroll) ────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const v = filterVersionRef.current;
    setLoadingMore(true);

    try {
      const { data, count } = await fetchEntityChartData({
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        minMentions:
          debouncedMinMentions > 0 ? debouncedMinMentions : undefined,
        section: sectionFilter || undefined,
        limit: PAGE_SIZE,
        offset: entities.length,
      });
      if (filterVersionRef.current !== v) return;
      setEntities((prev) => [...prev, ...data]);
      setTotalCount(count);
      setHasMore(entities.length + data.length < count);
    } catch (err) {
      if (filterVersionRef.current === v) {
        console.error("Failed to load more:", err);
      }
    } finally {
      if (filterVersionRef.current === v) setLoadingMore(false);
    }
  }, [
    loadingMore,
    hasMore,
    entities.length,
    debouncedSearch,
    sortBy,
    sortOrder,
    debouncedMinMentions,
    sectionFilter,
  ]);

  // ── Virtualizer ─────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: entities.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // ── Infinite scroll trigger ─────────────────────────────────────
  const lastItem = virtualItems[virtualItems.length - 1];

  useEffect(() => {
    if (!lastItem) return;
    if (lastItem.index >= entities.length - 30 && hasMore && !loadingMore) {
      loadMore();
    }
  }, [lastItem?.index, entities.length, hasMore, loadingMore, loadMore]);

  // ── Fetch section breakdowns for visible entities ───────────────
  const firstVisible = virtualItems[0]?.index ?? -1;
  const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? -1;
  const visibleEntityIds = useMemo(
    () =>
      virtualItems
        .map((item) => entities[item.index]?.entity_id)
        .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firstVisible, lastVisible, entities]
  );
  const debouncedVisibleIds = useDebounce(visibleEntityIds, 300);

  useEffect(() => {
    if (debouncedVisibleIds.length === 0) return;
    const uncached = debouncedVisibleIds.filter(
      (id) =>
        !breakdownCacheRef.current.has(id) && !pendingRef.current.has(id)
    );
    if (uncached.length === 0) return;

    uncached.forEach((id) => pendingRef.current.add(id));

    Promise.allSettled(
      uncached.map((id) =>
        getEntitySectionBreakdown(id)
          .then((data) => {
            breakdownCacheRef.current.set(id, data);
          })
          .finally(() => {
            pendingRef.current.delete(id);
          })
      )
    ).then(() => {
      setBreakdownVersion((v) => v + 1);
    });
  }, [debouncedVisibleIds]);

  // ── Computed ────────────────────────────────────────────────────
  const maxMentions = useMemo(
    () => Math.max(1, ...entities.map((e) => e.total_mentions)),
    [entities]
  );

  const sumMentions = useMemo(
    () => entities.reduce((s, e) => s + e.total_mentions, 0),
    [entities]
  );

  const topEntity = entities[0];

  const isFiltered =
    debouncedSearch.length > 0 ||
    debouncedMinMentions > 0 ||
    sectionFilter.length > 0;

  // ── Tooltip handlers ────────────────────────────────────────────
  const handleRowMouseEnter = useCallback(
    (entity: EntityMentionCount, e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const bd = breakdownCacheRef.current.get(entity.entity_id) ?? null;
      setTooltip({
        entity,
        breakdown: bd,
        x: Math.min(rect.right + 8, window.innerWidth - 280),
        y: rect.top,
      });

      // Fetch breakdown on demand if not cached
      if (
        !breakdownCacheRef.current.has(entity.entity_id) &&
        !pendingRef.current.has(entity.entity_id)
      ) {
        pendingRef.current.add(entity.entity_id);
        getEntitySectionBreakdown(entity.entity_id)
          .then((data) => {
            breakdownCacheRef.current.set(entity.entity_id, data);
            pendingRef.current.delete(entity.entity_id);
            setBreakdownVersion((v) => v + 1);
            // Update tooltip if still showing the same entity
            setTooltip((prev) =>
              prev?.entity.entity_id === entity.entity_id
                ? { ...prev, breakdown: data }
                : prev
            );
          })
          .catch(() => {
            pendingRef.current.delete(entity.entity_id);
          });
      }
    },
    []
  );

  const handleRowMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // ── Loading state ───────────────────────────────────────────────
  if (loading && entities.length === 0) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-1 h-3 w-80" />
        </CardHeader>
        <CardContent className="space-y-1">
          {Array.from({ length: 15 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <Card className="paper-grain border-border bg-card">
      {/* ── Header ─────────────────────────────────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-heading text-xl font-bold">
              Most Mentioned Entities
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Interactive chart &mdash; hover for breakdown, click to view
              entity
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-gold"
            onClick={() => exportCSV(entities)}
            disabled={entities.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Controls Bar ───────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search entities\u2026"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 bg-muted/30 pl-8 text-sm"
            />
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Sort
            </label>
            <select
              value={sortPresetIdx}
              onChange={(e) => setSortPresetIdx(Number(e.target.value))}
              className="chart-select h-9 rounded-md border border-border bg-muted/30 px-2.5 pr-7 text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50"
            >
              {SORT_PRESETS.map((p, i) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min Mentions */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Min mentions
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={minMentions}
                onChange={(e) => setMinMentions(Number(e.target.value))}
                className="chart-range h-1 w-24 cursor-pointer appearance-none rounded-full bg-border"
              />
              <span className="w-6 text-right font-mono text-xs text-muted-foreground">
                {minMentions}
              </span>
            </div>
          </div>

          {/* Section Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Section
            </label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="chart-select h-9 rounded-md border border-border bg-muted/30 px-2.5 pr-7 text-sm text-foreground outline-none focus:ring-1 focus:ring-gold/50"
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s} value={s}>
                  {cleanSectionLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {totalCount.toLocaleString()}
          </span>
          {isFiltered && unfilteredCount > 0 && (
            <>
              {" "}
              of{" "}
              <span className="font-medium text-foreground">
                {unfilteredCount.toLocaleString()}
              </span>
            </>
          )}{" "}
          entities
        </div>

        {/* ── Summary Bar ──────────────────────────────────── */}
        {topEntity && (
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-border/60 bg-muted/10 px-4 py-2.5">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Top Entity
              </span>
              <p className="text-sm font-medium text-gold">
                {topEntity.canonical_name}{" "}
                <span className="font-mono text-foreground">
                  ({topEntity.total_mentions.toLocaleString()})
                </span>
              </p>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Mentions
              </span>
              <p className="font-mono text-sm font-medium text-foreground">
                {sumMentions.toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Loaded
              </span>
              <p className="font-mono text-sm font-medium text-foreground">
                {entities.length.toLocaleString()} rows
              </p>
            </div>
          </div>
        )}

        {/* ── Chart Area ───────────────────────────────────── */}
        {entities.length === 0 && !loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No entities match the current filters.
          </div>
        ) : (
          <div>
            {/* Sticky column header */}
            <div className="flex items-center border-b border-border/60 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="w-[250px] max-w-[40vw] shrink-0">Entity</div>
              <div className="flex-1 px-2">Mentions</div>
              <div className="w-[72px] shrink-0 text-right">Count</div>
            </div>

            {/* Virtualized scroll container */}
            <div
              ref={scrollRef}
              className="relative overflow-auto"
              style={{ height: CHART_HEIGHT }}
            >
              <div
                className="relative w-full"
                style={{ height: virtualizer.getTotalSize() }}
              >
                {virtualItems.map((virtualRow) => {
                  const entity = entities[virtualRow.index];
                  if (!entity) return null;

                  // Read from cache ref (re-render driven by breakdownVersion)
                  void breakdownVersion;
                  const bd = breakdownCacheRef.current.get(entity.entity_id);
                  const barPct =
                    (entity.total_mentions / maxMentions) * 100;

                  return (
                    <div
                      key={entity.entity_id}
                      className="absolute left-0 flex w-full cursor-pointer items-center border-b border-border/20 px-1 transition-colors hover:bg-muted/10"
                      style={{
                        top: 0,
                        height: ROW_HEIGHT,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() =>
                        router.push(`/entity/${entity.entity_id}`)
                      }
                      onMouseEnter={(e) =>
                        handleRowMouseEnter(entity, e)
                      }
                      onMouseLeave={handleRowMouseLeave}
                    >
                      {/* Name column */}
                      <div
                        className="w-[250px] max-w-[40vw] shrink-0 truncate pr-3 text-sm text-foreground"
                        title={entity.canonical_name}
                      >
                        {entity.canonical_name}
                      </div>

                      {/* Bar column */}
                      <div className="flex flex-1 items-center px-2">
                        <div
                          className="flex h-[18px] overflow-hidden rounded-sm transition-all duration-300"
                          style={{ width: `${barPct}%`, minWidth: 2 }}
                        >
                          {bd && bd.length > 0 ? (
                            bd.map((seg, i) => (
                              <div
                                key={i}
                                className="h-full transition-all duration-300"
                                style={{
                                  width: `${
                                    (seg.mention_count /
                                      entity.total_mentions) *
                                    100
                                  }%`,
                                  backgroundColor: getSectionColor(
                                    seg.section
                                  ),
                                  minWidth: 1,
                                }}
                              />
                            ))
                          ) : (
                            <div
                              className="h-full w-full"
                              style={{
                                backgroundColor:
                                  entity.sections &&
                                  entity.sections.length > 0
                                    ? getSectionColor(entity.sections[0])
                                    : "#D4A843",
                              }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Count column */}
                      <div className="w-[72px] shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {entity.total_mentions.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Loading-more spinner at the end of the scroll area */}
              {loadingMore && (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  <span className="ml-2 text-xs text-muted-foreground">
                    Loading more&hellip;
                  </span>
                </div>
              )}
            </div>

            {/* Section color legend */}
            <div className="mt-3 flex flex-wrap gap-3 border-t border-border/40 pt-3">
              {LEGEND_ITEMS.map((item) => (
                <span
                  key={item.label}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* ── Tooltip (fixed position) ──────────────────────── */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm"
          style={{
            left: tooltip.x,
            top: Math.max(
              8,
              Math.min(tooltip.y, window.innerHeight - 280)
            ),
          }}
        >
          <p className="truncate text-sm font-semibold text-foreground">
            {tooltip.entity.canonical_name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {tooltip.entity.entity_type}
            {tooltip.entity.aliases && tooltip.entity.aliases.length > 0 && (
              <span className="ml-1 text-muted-foreground/70">
                &middot; aka {tooltip.entity.aliases.slice(0, 2).join(", ")}
                {tooltip.entity.aliases.length > 2 &&
                  ` +${tooltip.entity.aliases.length - 2}`}
              </span>
            )}
          </p>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">Mentions</span>
              <p className="font-mono font-medium text-gold">
                {tooltip.entity.total_mentions.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Documents</span>
              <p className="font-mono font-medium text-foreground">
                {tooltip.entity.unique_documents.toLocaleString()}
              </p>
            </div>
          </div>

          {tooltip.breakdown && tooltip.breakdown.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                By Section
              </p>
              {tooltip.breakdown.map((seg, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: getSectionColor(seg.section),
                    }}
                  />
                  <span className="flex-1 truncate text-muted-foreground">
                    {cleanSectionLabel(seg.section)}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {seg.mention_count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!tooltip.breakdown && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-2">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Loading breakdown&hellip;
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
});
