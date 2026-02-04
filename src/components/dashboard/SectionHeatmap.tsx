"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityMentions, batchSectionBreakdowns } from "@/lib/queries";
import type { EntityMentionCount, SectionBreakdown } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────

const MAX_ENTITIES = 50;

// ── Helpers ────────────────────────────────────────────────────────

function cleanSection(s: string) {
  return s.replace(/^\/epstein\//, "").replace(/\/$/, "") || "root";
}

/** Interpolate from dark slate (#141820) → gold (#D4A843). */
function cellColor(value: number, max: number): string {
  if (value === 0) return "#141820";
  const t = Math.min(value / max, 1);
  // Apply a sqrt scale so low values are more visible
  const st = Math.sqrt(t);
  const r = Math.round(20 + st * (212 - 20));
  const g = Math.round(24 + st * (168 - 24));
  const b = Math.round(32 + st * (67 - 32));
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Component ──────────────────────────────────────────────────────

export const SectionHeatmap = memo(function SectionHeatmap() {
  const [entities, setEntities] = useState<EntityMentionCount[]>([]);
  const [breakdowns, setBreakdowns] = useState<
    Map<string, SectionBreakdown[]>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingBreakdowns, setLoadingBreakdowns] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{
    entityId: string;
    section: string;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Fetch entities + breakdowns ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    getEntityMentions({
      sortBy: "total_mentions",
      sortOrder: "desc",
      limit: MAX_ENTITIES,
    })
      .then(({ data }) => {
        if (cancelled) return;
        setEntities(data);
        if (data.length === 0) return;

        setLoadingBreakdowns(true);
        return batchSectionBreakdowns(data.map((e) => e.entity_id));
      })
      .then((map) => {
        if (cancelled) return;
        if (map) setBreakdowns(map);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingBreakdowns(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Build matrix ─────────────────────────────────────────────────
  const { allSections, matrix, maxCount } = useMemo(() => {
    const sectionSet = new Set<string>();
    const mat = new Map<string, Map<string, number>>();
    let max = 0;

    for (const ent of entities) {
      const bd = breakdowns.get(ent.entity_id) || [];
      const sectionMap = new Map<string, number>();

      for (const b of bd) {
        const sec = cleanSection(b.section);
        sectionSet.add(sec);
        sectionMap.set(sec, b.mention_count);
        if (b.mention_count > max) max = b.mention_count;
      }
      mat.set(ent.entity_id, sectionMap);

      // Ensure sections from entity data are included
      for (const s of ent.sections || []) sectionSet.add(cleanSection(s));
    }

    return {
      allSections: Array.from(sectionSet).sort(),
      matrix: mat,
      maxCount: max,
    };
  }, [entities, breakdowns]);

  const getCellValue = (entityId: string, section: string): number =>
    matrix.get(entityId)?.get(section) || 0;

  // ── Loading skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (entities.length === 0 || allSections.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
        No section data available.
      </div>
    );
  }

  return (
    <div className="space-y-3 relative">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {entities.length} entities &times; {allSections.length} sections
          {loadingBreakdowns && (
            <Loader2 className="ml-2 inline-block h-3 w-3 animate-spin" />
          )}
        </p>
      </div>

      {/* Color-scale legend */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>0</span>
        <div
          className="h-3 w-32 rounded-sm"
          style={{
            background: `linear-gradient(to right, #141820, ${cellColor(maxCount, maxCount)})`,
          }}
        />
        <span>{maxCount.toLocaleString()}</span>
        <span className="ml-1">mentions</span>
      </div>

      {/* Scrollable heatmap table */}
      <div className="max-h-[520px] overflow-auto rounded border border-border/30">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr className="bg-card">
              <th className="sticky left-0 z-30 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[150px]">
                Entity
              </th>
              {allSections.map((sec) => (
                <th
                  key={sec}
                  className="px-0.5 py-1.5 text-center font-medium text-muted-foreground"
                  style={{
                    writingMode: "vertical-rl",
                    minWidth: 26,
                    maxWidth: 26,
                    fontSize: 9,
                  }}
                >
                  {sec}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entities.map((ent) => (
              <tr
                key={ent.entity_id}
                className="border-t border-border/20 transition-colors hover:bg-muted/5"
              >
                <td className="sticky left-0 z-10 bg-card px-2 py-0.5 whitespace-nowrap">
                  <Link
                    href={`/entity/${ent.entity_id}`}
                    className="text-foreground hover:text-gold transition-colors text-[11px]"
                  >
                    {ent.canonical_name.length > 22
                      ? ent.canonical_name.slice(0, 20) + "\u2026"
                      : ent.canonical_name}
                  </Link>
                </td>
                {allSections.map((sec) => {
                  const val = getCellValue(ent.entity_id, sec);
                  const isHovered =
                    hoveredCell?.entityId === ent.entity_id &&
                    hoveredCell?.section === sec;
                  return (
                    <td
                      key={sec}
                      className="px-0.5 py-0.5 text-center"
                      onMouseEnter={(e) => {
                        setHoveredCell({
                          entityId: ent.entity_id,
                          section: sec,
                        });
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) =>
                        setTooltipPos({ x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <span
                        className="inline-block h-[18px] w-[18px] rounded-[3px] transition-all"
                        style={{
                          backgroundColor: cellColor(val, maxCount),
                          outline: isHovered
                            ? "1.5px solid #D4A843"
                            : "none",
                          outlineOffset: 1,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 40,
            fontSize: 12,
          }}
        >
          <div className="font-semibold text-foreground">
            {entities.find((e) => e.entity_id === hoveredCell.entityId)
              ?.canonical_name}
          </div>
          <div className="text-muted-foreground">
            {hoveredCell.section}:{" "}
            <span className="text-gold font-medium">
              {getCellValue(
                hoveredCell.entityId,
                hoveredCell.section
              ).toLocaleString()}
            </span>{" "}
            mentions
          </div>
        </div>
      )}
    </div>
  );
});
