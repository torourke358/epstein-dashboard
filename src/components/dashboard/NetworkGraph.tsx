"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { getCoMentions, getEntityMentions } from "@/lib/queries";
import type { CoMention, EntityMentionCount } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  mentions: number;
  radius: number;
  color: string;
  showLabel: boolean;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  sourceId: string;
  targetId: string;
  coOccurrences: number;
  sharedDocs: number;
}

// ── Constants ───────────────────────────────────────────────────────

const VBOX_W = 1000;
const VBOX_H = 600;

const SECTION_COLORS: [string, string][] = [
  ["court", "#D4A843"],
  ["doj", "#4a8bc2"],
  ["foia", "#5b8a72"],
  ["house", "#7c6e9b"],
  ["fbi", "#c25d4a"],
];

// ── Helpers ─────────────────────────────────────────────────────────

function getNodeColor(sections: string[]): string {
  for (const sec of sections) {
    const lower = sec.toLowerCase();
    for (const [key, color] of SECTION_COLORS) {
      if (lower.includes(key)) return color;
    }
  }
  return "#8892a4";
}

// ── Component ───────────────────────────────────────────────────────

export const NetworkGraph = memo(function NetworkGraph() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  // Raw data
  const [rawCoMentions, setRawCoMentions] = useState<CoMention[]>([]);
  const [rawEntities, setRawEntities] = useState<EntityMentionCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Controls
  const [minCoOccurrences, setMinCoOccurrences] = useState(3);
  const [minMentions, setMinMentions] = useState(10);
  const [debouncedMinCo, setDebouncedMinCo] = useState(3);

  // Interaction
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{
    sourceName: string;
    targetName: string;
    sharedDocs: number;
    coOccurrences: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Zoom/Pan via viewBox
  const [viewBox, setViewBox] = useState({
    x: 0,
    y: 0,
    w: VBOX_W,
    h: VBOX_H,
  });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const clickTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // ── Debounce minCoOccurrences ──────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMinCo(minCoOccurrences), 300);
    return () => clearTimeout(t);
  }, [minCoOccurrences]);

  // ── Fetch data ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCoMentions({ minCoOccurrences: debouncedMinCo, limit: 500 }),
      getEntityMentions({
        sortBy: "total_mentions",
        sortOrder: "desc",
        limit: 200,
      }),
    ])
      .then(([cm, { data: ents }]) => {
        if (cancelled) return;
        setRawCoMentions(cm);
        setRawEntities(ents);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedMinCo]);

  // ── Build graph + run simulation ───────────────────────────────────
  const { nodes, links } = useMemo(() => {
    if (rawEntities.length === 0)
      return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const entityMap = new Map<string, EntityMentionCount>();
    for (const e of rawEntities) entityMap.set(e.entity_id, e);

    // Collect node IDs from edges (both ends must meet minMentions)
    const nodeIds = new Set<string>();
    for (const cm of rawCoMentions) {
      const a = entityMap.get(cm.entity_a_id);
      const b = entityMap.get(cm.entity_b_id);
      if (a && a.total_mentions >= minMentions) nodeIds.add(cm.entity_a_id);
      if (b && b.total_mentions >= minMentions) nodeIds.add(cm.entity_b_id);
    }

    const maxMentions = Math.max(
      ...Array.from(nodeIds).map(
        (id) => entityMap.get(id)?.total_mentions || 0
      ),
      1
    );
    const maxLog = Math.log2(maxMentions + 1);

    // Build nodes with deterministic initial positions
    const graphNodes: GraphNode[] = [];
    let idx = 0;
    for (const id of nodeIds) {
      const ent = entityMap.get(id);
      if (!ent) continue;
      const logScale = Math.log2(ent.total_mentions + 1);
      const angle = (2 * Math.PI * idx) / nodeIds.size;
      graphNodes.push({
        id,
        name: ent.canonical_name,
        mentions: ent.total_mentions,
        radius: 5 + (logScale / maxLog) * 18,
        color: getNodeColor(ent.sections || []),
        showLabel: ent.total_mentions >= 50,
        x: VBOX_W / 2 + 200 * Math.cos(angle),
        y: VBOX_H / 2 + 200 * Math.sin(angle),
      });
      idx++;
    }

    // Build links (only between existing filtered nodes)
    const graphLinks: GraphLink[] = rawCoMentions
      .filter(
        (cm) => nodeIds.has(cm.entity_a_id) && nodeIds.has(cm.entity_b_id)
      )
      .slice(0, 500)
      .map((cm) => ({
        source: cm.entity_a_id,
        target: cm.entity_b_id,
        sourceId: cm.entity_a_id,
        targetId: cm.entity_b_id,
        coOccurrences: cm.co_occurrence_count,
        sharedDocs: cm.shared_documents,
      }));

    if (graphNodes.length === 0)
      return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    // Run d3-force simulation synchronously
    const sim = forceSimulation<GraphNode>(graphNodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(80)
          .strength(0.3)
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(VBOX_W / 2, VBOX_H / 2))
      .force(
        "collide",
        forceCollide<GraphNode>().radius((d) => d.radius + 3)
      )
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    return { nodes: [...graphNodes], links: [...graphLinks] };
  }, [rawCoMentions, rawEntities, minMentions]);

  // Scaling helpers
  const maxCo = useMemo(
    () => Math.max(...links.map((l) => l.coOccurrences), 1),
    [links]
  );
  const maxShared = useMemo(
    () => Math.max(...links.map((l) => l.sharedDocs), 1),
    [links]
  );

  // ── Wheel zoom ─────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      setViewBox((prev) => {
        const mx =
          prev.x + ((e.clientX - rect.left) / rect.width) * prev.w;
        const my =
          prev.y + ((e.clientY - rect.top) / rect.height) * prev.h;
        const factor = e.deltaY > 0 ? 1.06 : 0.94;
        const newW = Math.max(200, Math.min(VBOX_W * 4, prev.w * factor));
        const newH = Math.max(120, Math.min(VBOX_H * 4, prev.h * factor));
        return {
          x: mx - (mx - prev.x) * (newW / prev.w),
          y: my - (my - prev.y) * (newH / prev.h),
          w: newW,
          h: newH,
        };
      });
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  // ── Pan handlers ───────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const tag = (e.target as Element).tagName;
    if (tag === "circle" || tag === "text") return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx =
        (e.clientX - lastMouse.current.x) * (viewBox.w / rect.width);
      const dy =
        (e.clientY - lastMouse.current.y) * (viewBox.h / rect.height);
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }));
    },
    [viewBox.w, viewBox.h]
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // ── Node click (single = highlight, double = navigate) ────────────
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const existing = clickTimeouts.current.get(nodeId);
      if (existing) {
        clearTimeout(existing);
        clickTimeouts.current.delete(nodeId);
        router.push(`/entity/${nodeId}`);
      } else {
        const timeout = setTimeout(() => {
          clickTimeouts.current.delete(nodeId);
          setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
        }, 300);
        clickTimeouts.current.set(nodeId, timeout);
      }
    },
    [router]
  );

  // ── Highlight helpers ──────────────────────────────────────────────
  const activeId = selectedNode || hoveredNode;

  const connectedIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    const set = new Set<string>();
    for (const l of links) {
      if (l.sourceId === activeId) set.add(l.targetId);
      if (l.targetId === activeId) set.add(l.sourceId);
    }
    return set;
  }, [activeId, links]);

  const getNodeOpacity = (id: string) => {
    if (!activeId) return 1;
    if (id === activeId || connectedIds.has(id)) return 1;
    return 0.12;
  };

  const getLinkOpacity = (link: GraphLink) => {
    const base = 0.2 + (link.sharedDocs / maxShared) * 0.5;
    if (!activeId) return base;
    if (link.sourceId === activeId || link.targetId === activeId)
      return 0.8;
    return 0.04;
  };

  const getLinkColor = (link: GraphLink) => {
    if (!activeId) return "#2a3a4e";
    if (link.sourceId === activeId || link.targetId === activeId)
      return "#D4A843";
    return "#1a2535";
  };

  // ── Reset zoom ─────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: VBOX_W, h: VBOX_H });
    setSelectedNode(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  if (loading && rawEntities.length === 0) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[600px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-bold">
          Co-Mention Network
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Entities that appear together in the same documents. Click to
          highlight, double-click to view details.
        </p>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Min co-occurrences
            </label>
            <input
              type="range"
              className="chart-range w-24"
              min={1}
              max={50}
              value={minCoOccurrences}
              onChange={(e) => setMinCoOccurrences(+e.target.value)}
            />
            <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">
              {minCoOccurrences}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Min mentions
            </label>
            <input
              type="range"
              className="chart-range w-24"
              min={1}
              max={200}
              value={minMentions}
              onChange={(e) => setMinMentions(+e.target.value)}
            />
            <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">
              {minMentions}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {nodes.length} nodes &middot; {links.length} edges
          </div>
          <button
            onClick={resetView}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset view
          </button>
        </div>
      </CardHeader>

      <CardContent className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        )}

        {nodes.length === 0 && !loading ? (
          <div className="flex h-[600px] items-center justify-center text-sm text-muted-foreground">
            No co-mention data. Try lowering the filter thresholds.
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            width="100%"
            height={600}
            className="rounded-lg border border-border/30 bg-[#0a0d12] select-none"
            style={{ cursor: isPanning.current ? "grabbing" : "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => {
              const tag = (e.target as Element).tagName;
              if (tag === "svg" || tag === "rect") setSelectedNode(null);
            }}
          >
            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.w}
              height={viewBox.h}
              fill="transparent"
            />

            {/* Links */}
            {links.map((link) => {
              const source = link.source as unknown as GraphNode;
              const target = link.target as unknown as GraphNode;
              if (
                source.x == null ||
                source.y == null ||
                target.x == null ||
                target.y == null
              )
                return null;
              const thickness = 1 + (link.coOccurrences / maxCo) * 4;

              return (
                <g key={`${link.sourceId}-${link.targetId}`}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={getLinkColor(link)}
                    strokeWidth={thickness}
                    opacity={getLinkOpacity(link)}
                  />
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke="transparent"
                    strokeWidth={Math.max(thickness + 8, 12)}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      const sn =
                        nodes.find((n) => n.id === link.sourceId)?.name || "";
                      const tn =
                        nodes.find((n) => n.id === link.targetId)?.name || "";
                      setHoveredLink({
                        sourceName: sn,
                        targetName: tn,
                        sharedDocs: link.sharedDocs,
                        coOccurrences: link.coOccurrences,
                      });
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) =>
                      setTooltipPos({ x: e.clientX, y: e.clientY })
                    }
                    onMouseLeave={() => setHoveredLink(null)}
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              if (node.x == null || node.y == null) return null;
              const isActive = node.id === activeId;
              const isHovered = node.id === hoveredNode;
              const showLabel = node.showLabel || isHovered || isActive;

              return (
                <g key={node.id} opacity={getNodeOpacity(node.id)}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius}
                    fill={node.color}
                    stroke={isActive ? "#fff" : isHovered ? "#e2e8f0" : "none"}
                    strokeWidth={isActive ? 2 : isHovered ? 1.5 : 0}
                    className="cursor-pointer transition-[stroke] duration-150"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node.id);
                    }}
                  />
                  {showLabel && (
                    <text
                      x={node.x}
                      y={node.y! - node.radius - 4}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize={10}
                      fontWeight={isActive ? 600 : 400}
                      pointerEvents="none"
                    >
                      {node.name.length > 20
                        ? node.name.slice(0, 18) + "\u2026"
                        : node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Section color legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          {SECTION_COLORS.map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "#8892a4" }}
            />
            other
          </div>
        </div>

        {/* Link tooltip */}
        {hoveredLink && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 40,
              fontSize: 12,
            }}
          >
            <span className="text-foreground font-medium">
              {hoveredLink.sourceName}
            </span>
            <span className="text-muted-foreground"> &harr; </span>
            <span className="text-foreground font-medium">
              {hoveredLink.targetName}
            </span>
            <br />
            <span className="text-gold font-medium">
              {hoveredLink.sharedDocs}
            </span>
            <span className="text-muted-foreground"> shared documents, </span>
            <span className="text-gold font-medium">
              {hoveredLink.coOccurrences}
            </span>
            <span className="text-muted-foreground"> co-occurrences</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
