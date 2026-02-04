"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityMentions, getEntityDocTypeData } from "@/lib/queries";
import type { EntityMentionCount } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<string, string> = {
  email: "#4a8bc2",
  court_filing: "#D4A843",
  fbi_memo: "#c25d4a",
  foia_response: "#5b8a72",
  deposition: "#7c6e9b",
  grand_jury: "#E8C164",
  other: "#8892a4",
};

const KNOWN_DOC_TYPES = Object.keys(DOC_TYPE_COLORS);
const MAX_ENTITIES = 10;

// ── Helpers ────────────────────────────────────────────────────────

function getDocTypeColor(dt: string): string {
  return DOC_TYPE_COLORS[dt] || DOC_TYPE_COLORS.other;
}

function normalizeDocType(dt: string): string {
  const lower = dt.toLowerCase().replace(/[\s-]+/g, "_");
  if (KNOWN_DOC_TYPES.includes(lower)) return lower;
  return "other";
}

// ── Component ──────────────────────────────────────────────────────

export const DocumentTypeBreakdown = memo(function DocumentTypeBreakdown() {
  const [allEntities, setAllEntities] = useState<EntityMentionCount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);

  // ── Fetch entity list on mount ───────────────────────────────────
  useEffect(() => {
    getEntityMentions({
      sortBy: "total_mentions",
      sortOrder: "desc",
      limit: 20,
    })
      .then(({ data }) => {
        setAllEntities(data);
        setSelectedIds(
          new Set(data.slice(0, MAX_ENTITIES).map((e) => e.entity_id))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Name lookup ──────────────────────────────────────────────────
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    allEntities.forEach((e) => m.set(e.entity_id, e.canonical_name));
    return m;
  }, [allEntities]);

  // ── Fetch doc-type data when selection changes ───────────────────
  useEffect(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setChartData([]);
      setDocTypes([]);
      return;
    }
    setLoadingChart(true);

    getEntityDocTypeData(ids)
      .then((mentions) => {
        // entity_id → { doc_type → count }
        const grouped = new Map<string, Map<string, number>>();
        const allTypes = new Set<string>();

        for (const m of mentions) {
          const dt = normalizeDocType(m.doc_type);
          allTypes.add(dt);
          if (!grouped.has(m.entity_id)) grouped.set(m.entity_id, new Map());
          const em = grouped.get(m.entity_id)!;
          em.set(dt, (em.get(dt) || 0) + 1);
        }

        // Sort doc types by overall frequency
        const typeFreq = new Map<string, number>();
        for (const em of grouped.values()) {
          for (const [dt, c] of em) typeFreq.set(dt, (typeFreq.get(dt) || 0) + c);
        }
        const sorted = Array.from(allTypes).sort(
          (a, b) => (typeFreq.get(b) || 0) - (typeFreq.get(a) || 0)
        );
        setDocTypes(sorted);

        // Build chart rows sorted by total mentions desc
        const rows = ids
          .map((id) => {
            const name = nameById.get(id) || id;
            const em = grouped.get(id) || new Map();
            const row: Record<string, unknown> = {
              name: name.length > 16 ? name.slice(0, 14) + "\u2026" : name,
              fullName: name,
              entityId: id,
            };
            for (const dt of sorted) row[dt] = em.get(dt) || 0;
            return row;
          })
          .sort((a, b) => {
            const ta = sorted.reduce((s, dt) => s + ((a[dt] as number) || 0), 0);
            const tb = sorted.reduce((s, dt) => s + ((b[dt] as number) || 0), 0);
            return tb - ta;
          });

        setChartData(rows);
      })
      .catch(console.error)
      .finally(() => setLoadingChart(false));
  }, [selectedIds, nameById]);

  // ── Toggle handlers ──────────────────────────────────────────────
  const toggleEntity = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_ENTITIES) next.add(id);
      return next;
    });
  }, []);

  const toggleDocType = useCallback((dt: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(dt)) next.delete(dt);
      else next.add(dt);
      return next;
    });
  }, []);

  // ── Loading skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-28" />
          ))}
        </div>
        <Skeleton className="h-[360px] w-full" />
      </div>
    );
  }

  const visibleDocTypes = docTypes.filter((dt) => !hiddenTypes.has(dt));

  return (
    <div className="space-y-4">
      {/* Entity selector */}
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Select entities (max {MAX_ENTITIES})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {allEntities.map((ent) => {
            const active = selectedIds.has(ent.entity_id);
            return (
              <button
                key={ent.entity_id}
                onClick={() => toggleEntity(ent.entity_id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-transparent bg-muted/50 text-foreground"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="max-w-[140px] truncate">
                  {ent.canonical_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Doc-type legend (toggleable) */}
      {docTypes.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Document types (click to toggle)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {docTypes.map((dt) => {
              const hidden = hiddenTypes.has(dt);
              return (
                <button
                  key={dt}
                  onClick={() => toggleDocType(dt)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    hidden
                      ? "border-border/40 text-muted-foreground/50"
                      : "border-transparent bg-muted/50 text-foreground"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: hidden
                        ? "transparent"
                        : getDocTypeColor(dt),
                      border: hidden
                        ? `1.5px solid ${getDocTypeColor(dt)}`
                        : "none",
                      opacity: hidden ? 0.4 : 1,
                    }}
                  />
                  {dt.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stacked bar chart */}
      {loadingChart ? (
        <div className="flex h-[360px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2a3a"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: "#8892a4", fontSize: 10 }}
              axisLine={{ stroke: "#1e2a3a" }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fill: "#8892a4", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={50}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#151921",
                border: "1px solid #1e2a3a",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
              labelFormatter={(_label, payload) => {
                const p = payload?.[0]?.payload;
                return (p as Record<string, string> | undefined)?.fullName ??
                  String(_label);
              }}
              formatter={(value, name) => [
                typeof value === "number"
                  ? value.toLocaleString()
                  : String(value),
                typeof name === "string" ? name.replace(/_/g, " ") : name,
              ]}
            />
            {visibleDocTypes.map((dt, i) => (
              <Bar
                key={dt}
                dataKey={dt}
                name={dt}
                stackId="a"
                fill={getDocTypeColor(dt)}
                radius={
                  i === visibleDocTypes.length - 1
                    ? [3, 3, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : selectedIds.size > 0 ? (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          No document type data available for selected entities.
        </div>
      ) : (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          Select at least one entity to see the breakdown.
        </div>
      )}
    </div>
  );
});
