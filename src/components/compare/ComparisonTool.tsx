"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Loader2, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  searchEntities,
  getComparisonStats,
  getEntitySectionBreakdown,
  getTimelineMentions,
  getEntityDocTypeData,
  getEntityCoMentions,
} from "@/lib/queries";
import type {
  EntitySearchResult,
  EntityMentionCount,
  SectionBreakdown,
  SharedDocumentPair,
} from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────

const COLORS = [
  "#D4A843",
  "#4a8bc2",
  "#5b8a72",
  "#7c6e9b",
  "#c25d4a",
];

const DOC_TYPE_COLORS: Record<string, string> = {
  email: "#4a8bc2",
  court_filing: "#D4A843",
  fbi_memo: "#c25d4a",
  foia_response: "#5b8a72",
  deposition: "#7c6e9b",
  grand_jury: "#E8C164",
  other: "#8892a4",
};

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(d: string) {
  const p = d.split("-");
  if (p.length === 3) return `${p[1]}/${p[2]}`;
  return d;
}

// ── Component ──────────────────────────────────────────────────────

export function ComparisonTool() {
  // Entity selection state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<
    { id: string; name: string }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Data state
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<EntityMentionCount[]>([]);
  const [sectionBreakdowns, setSectionBreakdowns] = useState<
    Map<string, SectionBreakdown[]>
  >(new Map());
  const [timelineData, setTimelineData] = useState<
    { entity_id: string; date: string }[]
  >([]);
  const [docTypeData, setDocTypeData] = useState<
    { entity_id: string; doc_type: string }[]
  >([]);
  const [sharedPairs, setSharedPairs] = useState<SharedDocumentPair[]>([]);

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchEntities(searchTerm, 10);
        const selectedIds = new Set(selectedEntities.map((e) => e.id));
        setSearchResults(results.filter((r) => !selectedIds.has(r.id)));
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, selectedEntities]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addEntity = useCallback(
    (entity: EntitySearchResult) => {
      if (selectedEntities.length >= 5) return;
      if (selectedEntities.some((e) => e.id === entity.id)) return;
      setSelectedEntities((prev) => [
        ...prev,
        { id: entity.id, name: entity.canonical_name },
      ]);
      setSearchTerm("");
      setShowDropdown(false);
    },
    [selectedEntities]
  );

  const removeEntity = useCallback((id: string) => {
    setSelectedEntities((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Load comparison data
  const loadData = useCallback(async () => {
    if (selectedEntities.length < 2) return;
    setLoading(true);
    try {
      const ids = selectedEntities.map((e) => e.id);

      const [statsData, timeline, docTypes] = await Promise.all([
        getComparisonStats(ids),
        getTimelineMentions(ids),
        getEntityDocTypeData(ids),
      ]);

      setStats(statsData);
      setTimelineData(timeline);
      setDocTypeData(docTypes);

      // Section breakdowns
      const breakdowns = new Map<string, SectionBreakdown[]>();
      await Promise.allSettled(
        ids.map((id) =>
          getEntitySectionBreakdown(id).then((data) =>
            breakdowns.set(id, data)
          )
        )
      );
      setSectionBreakdowns(breakdowns);

      // Shared documents for each pair
      const pairs: SharedDocumentPair[] = [];
      for (let i = 0; i < ids.length; i++) {
        const coMentions = await getEntityCoMentions(ids[i]);
        for (let j = i + 1; j < ids.length; j++) {
          const match = coMentions.find((cm) => cm.entity_id === ids[j]);
          pairs.push({
            entity_a_id: ids[i],
            entity_a_name: selectedEntities[i].name,
            entity_b_id: ids[j],
            entity_b_name: selectedEntities[j].name,
            shared_count: match?.shared_documents || 0,
          });
        }
      }
      setSharedPairs(pairs.sort((a, b) => b.shared_count - a.shared_count));
    } catch (err) {
      console.error("Comparison load error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedEntities]);

  // Entity name -> color map
  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    selectedEntities.forEach((e, i) => m.set(e.id, COLORS[i % COLORS.length]));
    return m;
  }, [selectedEntities]);

  // Timeline chart data
  const timelineChartData = useMemo(() => {
    if (timelineData.length === 0) return [];
    const grouped = new Map<string, Record<string, number>>();
    for (const row of timelineData) {
      if (!grouped.has(row.date)) grouped.set(row.date, {});
      const entry = grouped.get(row.date)!;
      entry[row.entity_id] = (entry[row.entity_id] || 0) + 1;
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }, [timelineData]);

  // Doc type chart data
  const docTypeChartData = useMemo(() => {
    if (docTypeData.length === 0) return [];
    const grouped = new Map<
      string,
      Map<string, number>
    >();
    for (const row of docTypeData) {
      if (!grouped.has(row.doc_type))
        grouped.set(row.doc_type, new Map());
      const entry = grouped.get(row.doc_type)!;
      entry.set(row.entity_id, (entry.get(row.entity_id) || 0) + 1);
    }
    return Array.from(grouped.entries()).map(([doc_type, entityMap]) => {
      const row: Record<string, string | number> = { doc_type };
      for (const [entityId, count] of entityMap) {
        row[entityId] = count;
      }
      return row;
    });
  }, [docTypeData]);

  const hasData = stats.length > 0;

  return (
    <div className="space-y-6">
      {/* Entity selector */}
      <Card className="paper-grain border-border bg-card">
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Select Entities to Compare (2-5)
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {selectedEntities.map((entity) => (
              <Badge
                key={entity.id}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
                style={{
                  borderColor: colorMap.get(entity.id),
                  borderWidth: 1,
                }}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorMap.get(entity.id) }}
                />
                {entity.name}
                <button
                  onClick={() => removeEntity(entity.id)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <div ref={searchRef} className="relative flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    selectedEntities.length >= 5
                      ? "Max 5 entities"
                      : "Search entities..."
                  }
                  disabled={selectedEntities.length >= 5}
                  className="w-full rounded-md border border-border bg-muted/30 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => addEntity(result)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium text-foreground">
                        {result.canonical_name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {result.entity_type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={loadData}
              disabled={selectedEntities.length < 2 || loading}
              className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-bright disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Compare"
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedEntities.map((e) => (
              <Skeleton key={e.id} className="h-32 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {/* Results */}
      {!loading && hasData && (
        <>
          {/* Side-by-side stats cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {selectedEntities.map((entity) => {
              const stat = stats.find((s) => s.entity_id === entity.id);
              const breakdown = sectionBreakdowns.get(entity.id) || [];
              const primarySection = breakdown.length > 0
                ? breakdown.sort((a, b) => b.mention_count - a.mention_count)[0].section
                : "N/A";
              const primaryDocType = stat?.doc_types?.[0] || "N/A";
              return (
                <Card
                  key={entity.id}
                  className="paper-grain border-border bg-card"
                  style={{ borderTopColor: colorMap.get(entity.id), borderTopWidth: 2 }}
                >
                  <CardContent className="p-4">
                    <p className="font-heading text-sm font-bold text-foreground truncate">
                      {entity.name}
                    </p>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mentions</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {stat?.total_mentions?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Documents</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {stat?.unique_documents?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Primary Section
                        </span>
                        <span className="font-medium text-foreground truncate ml-2 text-right">
                          {primarySection.replace("/epstein/", "")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Primary Type
                        </span>
                        <span className="font-medium text-foreground capitalize">
                          {primaryDocType.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Timeline overlay chart */}
          {timelineChartData.length > 0 && (
            <Card className="paper-grain border-border bg-card">
              <CardContent className="p-5">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mention Timeline
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={formatDate}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const entity = selectedEntities.find(
                          (e) => e.id === value
                        );
                        return entity?.name || value;
                      }}
                    />
                    {selectedEntities.map((entity, i) => (
                      <Line
                        key={entity.id}
                        type="monotone"
                        dataKey={entity.id}
                        name={entity.id}
                        stroke={COLORS[i % COLORS.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Doc type grouped bar chart */}
          {docTypeChartData.length > 0 && (
            <Card className="paper-grain border-border bg-card">
              <CardContent className="p-5">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mentions by Document Type
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={docTypeChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="doc_type"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickFormatter={(v: string) => v.replace(/_/g, " ")}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      formatter={((value: number | undefined, name: string | undefined) => {
                        const entity = selectedEntities.find(
                          (e) => e.id === (name ?? "")
                        );
                        return [value ?? 0, entity?.name || name || ""];
                      }) as never}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const entity = selectedEntities.find(
                          (e) => e.id === value
                        );
                        return entity?.name || value;
                      }}
                    />
                    {selectedEntities.map((entity, i) => (
                      <Bar
                        key={entity.id}
                        dataKey={entity.id}
                        name={entity.id}
                        fill={COLORS[i % COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Shared documents table */}
          {sharedPairs.length > 0 && (
            <Card className="paper-grain border-border bg-card">
              <CardContent className="p-5">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Shared Documents
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                          Entity A
                        </th>
                        <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                          Entity B
                        </th>
                        <th className="pb-2 text-right text-xs font-medium text-muted-foreground">
                          Shared Documents
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedPairs.map((pair) => (
                        <tr
                          key={`${pair.entity_a_id}-${pair.entity_b_id}`}
                          className="border-b border-border/30"
                        >
                          <td className="py-2 pr-4">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: colorMap.get(
                                    pair.entity_a_id
                                  ),
                                }}
                              />
                              {pair.entity_a_name}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: colorMap.get(
                                    pair.entity_b_id
                                  ),
                                }}
                              />
                              {pair.entity_b_name}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium">
                            {pair.shared_count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary text */}
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {sharedPairs
                    .filter((p) => p.shared_count > 0)
                    .map((pair) => (
                      <p key={`${pair.entity_a_id}-${pair.entity_b_id}-summary`}>
                        {pair.entity_a_name} &amp; {pair.entity_b_name} share{" "}
                        <span className="font-medium text-foreground">
                          {pair.shared_count}
                        </span>{" "}
                        documents.
                      </p>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && !hasData && selectedEntities.length >= 2 && (
        <Card className="paper-grain border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Click &quot;Compare&quot; to load comparison data.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
