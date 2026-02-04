"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityMentions, getTimelineMentions } from "@/lib/queries";
import type { EntityMentionCount } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────

const LINE_COLORS = [
  "#D4A843",
  "#4a8bc2",
  "#5b8a72",
  "#7c6e9b",
  "#c25d4a",
  "#E8C164",
  "#6b8fa3",
  "#9b6e8b",
  "#b2914a",
  "#5e9b8a",
];

const MAX_SELECTED = 10;

// ── Helpers ────────────────────────────────────────────────────────

function formatDate(d: string) {
  const p = d.split("-");
  if (p.length === 3) return `${p[1]}/${p[2]}`;
  return d;
}

// ── Component ──────────────────────────────────────────────────────

export const MentionTimeline = memo(function MentionTimeline() {
  const [allEntities, setAllEntities] = useState<EntityMentionCount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timelineData, setTimelineData] = useState<
    Record<string, unknown>[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [noDateVariation, setNoDateVariation] = useState(false);

  // ── Fetch entity list on mount ───────────────────────────────────
  useEffect(() => {
    getEntityMentions({
      sortBy: "total_mentions",
      sortOrder: "desc",
      limit: 20,
    })
      .then(({ data }) => {
        setAllEntities(data);
        setSelectedIds(new Set(data.slice(0, 5).map((e) => e.entity_id)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Entity name lookup ───────────────────────────────────────────
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    allEntities.forEach((e) => m.set(e.entity_id, e.canonical_name));
    return m;
  }, [allEntities]);

  // ── Fetch timeline data when selection changes ───────────────────
  useEffect(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      setTimelineData([]);
      return;
    }
    setLoadingChart(true);

    getTimelineMentions(ids)
      .then((mentions) => {
        // Check date variation
        const uniqueDates = new Set(mentions.map((m) => m.date));
        if (uniqueDates.size <= 1) {
          setNoDateVariation(true);
          setTimelineData([]);
          return;
        }
        setNoDateVariation(false);

        // Group by date → { date, entityNameA: count, entityNameB: count }
        const grouped = new Map<string, Record<string, number>>();
        for (const m of mentions) {
          const name = nameById.get(m.entity_id) || m.entity_id;
          const existing = grouped.get(m.date) || {};
          existing[name] = (existing[name] || 0) + 1;
          grouped.set(m.date, existing);
        }

        const sorted = Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => ({ date, ...counts }));

        setTimelineData(sorted);
      })
      .catch(console.error)
      .finally(() => setLoadingChart(false));
  }, [selectedIds, nameById]);

  // ── Selected entities in stable order ────────────────────────────
  const selectedEntities = useMemo(
    () => allEntities.filter((e) => selectedIds.has(e.entity_id)),
    [allEntities, selectedIds]
  );

  // ── Toggle handler ───────────────────────────────────────────────
  const toggleEntity = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTED) {
        next.add(id);
      }
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

  return (
    <div className="space-y-4">
      {/* Entity selector */}
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Select entities to compare (max {MAX_SELECTED})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {allEntities.map((ent) => {
            const idx = allEntities.findIndex(
              (e) => e.entity_id === ent.entity_id
            );
            const active = selectedIds.has(ent.entity_id);
            const color = LINE_COLORS[idx % LINE_COLORS.length];
            return (
              <button
                key={ent.entity_id}
                onClick={() => toggleEntity(ent.entity_id)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-transparent bg-muted/50 text-foreground"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: active ? color : "transparent",
                    border: active ? "none" : `1.5px solid ${color}`,
                  }}
                />
                <span className="max-w-[140px] truncate">
                  {ent.canonical_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {loadingChart ? (
        <div className="flex h-[360px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : noDateVariation ? (
        /* Fallback: bar chart of selected entities when dates don't vary */
        <div>
          <div className="mb-3 rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
            All documents share the same discovery date, so a temporal
            timeline is not possible. Showing mention counts by entity
            instead.
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={selectedEntities.map((e) => ({
                name:
                  e.canonical_name.length > 18
                    ? e.canonical_name.slice(0, 16) + "\u2026"
                    : e.canonical_name,
                mentions: e.total_mentions,
              }))}
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
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
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: "#8892a4", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#151921",
                  border: "1px solid #1e2a3a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [
                  typeof value === "number"
                    ? value.toLocaleString()
                    : String(value),
                  "Mentions",
                ]}
              />
              <Bar dataKey="mentions" radius={[4, 4, 0, 0]} barSize={24}>
                {selectedEntities.map((_, i) => (
                  <Cell
                    key={i}
                    fill={LINE_COLORS[i % LINE_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : timelineData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={timelineData}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2a3a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8892a4", fontSize: 10 }}
              axisLine={{ stroke: "#1e2a3a" }}
              tickLine={false}
              tickFormatter={formatDate}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "#8892a4", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={45}
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
              labelFormatter={(label) => String(label)}
              formatter={(value, name) => [
                typeof value === "number"
                  ? value.toLocaleString()
                  : String(value),
                name,
              ]}
            />
            {selectedEntities.map((ent, i) => (
              <Line
                key={ent.entity_id}
                type="monotone"
                dataKey={ent.canonical_name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
              />
            ))}
            {timelineData.length > 30 && (
              <Brush
                dataKey="date"
                height={28}
                stroke="#D4A843"
                fill="#0c0f14"
                tickFormatter={formatDate}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : selectedIds.size > 0 ? (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          No mention data available for selected entities.
        </div>
      ) : (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          Select at least one entity to see the timeline.
        </div>
      )}
    </div>
  );
});
