"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityMentions, getEntityDocTypeData } from "@/lib/queries";
import type { EntityMentionCount } from "@/lib/types";

// ── Constants ───────────────────────────────────────────────────────

const MAX_ENTITIES = 30;

// ── Helpers ─────────────────────────────────────────────────────────

function formatDocType(dt: string): string {
  return dt
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Interpolate from dark slate (#141820) to gold (#D4A843). */
function cellColor(value: number, max: number): string {
  if (value === 0) return "#141820";
  const t = Math.min(value / max, 1);
  const st = Math.sqrt(t); // sqrt scale for better visibility of low values
  const r = Math.round(20 + st * (212 - 20));
  const g = Math.round(24 + st * (168 - 24));
  const b = Math.round(32 + st * (67 - 32));
  return `rgb(${r}, ${g}, ${b})`;
}

// ── Types ───────────────────────────────────────────────────────────

interface DocTypeHeatmapProps {
  selectedEntityId?: string | null;
  selectedDocType?: string | null;
}

// ── Component ───────────────────────────────────────────────────────

export const DocTypeHeatmap = memo(function DocTypeHeatmap({
  selectedEntityId,
  selectedDocType,
}: DocTypeHeatmapProps) {
  const [entities, setEntities] = useState<EntityMentionCount[]>([]);
  const [rawMentions, setRawMentions] = useState<
    { entity_id: string; doc_type: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{
    entityId: string;
    docType: string;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // ── Fetch entities + doc type data ────────────────────────────────
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
        if (data.length === 0) {
          setLoading(false);
          return;
        }

        setLoadingMentions(true);
        return getEntityDocTypeData(data.map((e) => e.entity_id));
      })
      .then((mentions) => {
        if (cancelled) return;
        if (mentions) setRawMentions(mentions);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingMentions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Build matrix ──────────────────────────────────────────────────
  const { allDocTypes, matrix, maxCount } = useMemo(() => {
    const docTypeSet = new Set<string>();
    const mat = new Map<string, Map<string, number>>();
    let max = 0;

    for (const m of rawMentions) {
      const dt = m.doc_type || "unknown";
      docTypeSet.add(dt);

      if (!mat.has(m.entity_id)) mat.set(m.entity_id, new Map());
      const entityMap = mat.get(m.entity_id)!;
      const current = entityMap.get(dt) || 0;
      const updated = current + 1;
      entityMap.set(dt, updated);
      if (updated > max) max = updated;
    }

    // Sort doc types by overall frequency
    const typeFreq = new Map<string, number>();
    for (const entityMap of mat.values()) {
      for (const [dt, count] of entityMap) {
        typeFreq.set(dt, (typeFreq.get(dt) || 0) + count);
      }
    }
    const sorted = Array.from(docTypeSet).sort(
      (a, b) => (typeFreq.get(b) || 0) - (typeFreq.get(a) || 0)
    );

    return {
      allDocTypes: sorted,
      matrix: mat,
      maxCount: max,
    };
  }, [rawMentions]);

  const getCellValue = (entityId: string, docType: string): number =>
    matrix.get(entityId)?.get(docType) || 0;

  // ── Loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (entities.length === 0 || allDocTypes.length === 0) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-bold">
            Entity &times; Document Type Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">
            No heatmap data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-bold">
          Entity &times; Document Type Heatmap
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {entities.length} entities &times; {allDocTypes.length} document types
          {loadingMentions && (
            <Loader2 className="ml-2 inline-block h-3 w-3 animate-spin" />
          )}
        </p>
      </CardHeader>

      <CardContent className="relative space-y-3">
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
        <div className="max-h-[560px] overflow-auto rounded border border-border/30">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="bg-card">
                <th className="sticky left-0 z-30 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[160px]">
                  Entity
                </th>
                {allDocTypes.map((dt) => (
                  <th
                    key={dt}
                    className={`px-0.5 py-1.5 text-center font-medium transition-opacity ${
                      selectedDocType && selectedDocType !== dt
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground"
                    }`}
                    style={{
                      writingMode: "vertical-rl",
                      minWidth: 30,
                      maxWidth: 30,
                      fontSize: 9,
                    }}
                  >
                    {formatDocType(dt)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entities.map((ent) => {
                const isHighlighted =
                  selectedEntityId === ent.entity_id;
                return (
                  <tr
                    key={ent.entity_id}
                    className={`border-t border-border/20 transition-colors ${
                      isHighlighted
                        ? "bg-gold/5"
                        : "hover:bg-muted/5"
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-10 bg-card px-2 py-0.5 whitespace-nowrap ${
                        isHighlighted ? "bg-gold/5" : ""
                      }`}
                    >
                      <Link
                        href={`/entity/${ent.entity_id}`}
                        className={`transition-colors text-[11px] ${
                          isHighlighted
                            ? "text-gold font-medium"
                            : "text-foreground hover:text-gold"
                        }`}
                      >
                        {ent.canonical_name.length > 24
                          ? ent.canonical_name.slice(0, 22) + "\u2026"
                          : ent.canonical_name}
                      </Link>
                    </td>
                    {allDocTypes.map((dt) => {
                      const val = getCellValue(ent.entity_id, dt);
                      const isHovered =
                        hoveredCell?.entityId === ent.entity_id &&
                        hoveredCell?.docType === dt;
                      const dimmed =
                        selectedDocType && selectedDocType !== dt;

                      return (
                        <td
                          key={dt}
                          className="px-0.5 py-0.5 text-center"
                          onMouseEnter={(e) => {
                            setHoveredCell({
                              entityId: ent.entity_id,
                              docType: dt,
                            });
                            setTooltipPos({
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }}
                          onMouseMove={(e) =>
                            setTooltipPos({
                              x: e.clientX,
                              y: e.clientY,
                            })
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
                              opacity: dimmed ? 0.3 : 1,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
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
              {formatDocType(hoveredCell.docType)}:{" "}
              <span className="text-gold font-medium">
                {getCellValue(
                  hoveredCell.entityId,
                  hoveredCell.docType
                ).toLocaleString()}
              </span>{" "}
              mentions
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
