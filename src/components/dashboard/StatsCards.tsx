"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Users, MessageSquareQuote, FolderOpen, RefreshCw } from "lucide-react";
import { getDashboardStats } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import type { DashboardStats } from "@/lib/types";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Thin horizontal bar showing relative proportions. */
function MiniBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all duration-500"
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            {seg.label}: {seg.value.toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = () => {
    setLoading(true);
    getDashboardStats()
      .then(setStats)
      .catch((err) => console.error("Failed to load stats:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await supabase.rpc("refresh_mention_counts");
      await getDashboardStats().then(setStats);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="paper-grain border-border bg-card">
            <CardContent className="p-5">
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const processedPct =
    stats.total_documents > 0
      ? ((stats.processed / stats.total_documents) * 100).toFixed(1)
      : "0";

  const sectionSegments = [
    { label: "Discovered", value: stats.discovered, color: "#4a8bc2" },
    { label: "Downloaded", value: stats.downloaded, color: "#7c6e9b" },
    { label: "Extracted", value: stats.extracted, color: "#5b8a72" },
    { label: "Processed", value: stats.processed, color: "#D4A843" },
    ...(stats.failed > 0
      ? [{ label: "Failed", value: stats.failed, color: "#c25d4a" }]
      : []),
  ];

  const cards = [
    {
      label: "Documents Processed",
      value: formatNumber(stats.processed),
      sub: `${processedPct}% of ${stats.total_documents.toLocaleString()} total`,
      icon: FileText,
      accent: "text-chart-5",
    },
    {
      label: "Unique Entities",
      value: formatNumber(stats.total_entities),
      sub: "People, orgs, locations identified",
      icon: Users,
      accent: "text-gold",
    },
    {
      label: "Total Mentions",
      value: formatNumber(stats.total_mentions),
      sub: `Across ${stats.processed.toLocaleString()} documents`,
      icon: MessageSquareQuote,
      accent: "text-chart-2",
    },
    {
      label: "Pipeline Status",
      value: stats.failed > 0 ? `${stats.failed} failed` : "Healthy",
      sub: `${stats.total_text_length.toLocaleString()} chars extracted`,
      icon: FolderOpen,
      accent: stats.failed > 0 ? "text-destructive" : "text-chart-2",
      breakdown: sectionSegments,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="paper-grain border-border bg-card transition-colors hover:border-gold/20"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                    {card.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {card.sub}
                  </p>
                </div>
                <card.icon className={`h-5 w-5 ${card.accent} opacity-60`} />
              </div>
              {card.breakdown && <MiniBar segments={card.breakdown} />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
