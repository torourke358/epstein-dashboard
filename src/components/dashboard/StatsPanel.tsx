"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Users,
  MessageSquareQuote,
  Activity,
  RefreshCw,
  Clock,
} from "lucide-react";
import { getDashboardStats } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import type { DashboardStats } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Component ───────────────────────────────────────────────────────

export function StatsPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = () => {
    setLoading(true);
    getDashboardStats()
      .then((data) => {
        setStats(data);
        setLastUpdated(new Date());
      })
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
      const data = await getDashboardStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardContent className="space-y-4 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const processedPct =
    stats.total_documents > 0
      ? ((stats.processed / stats.total_documents) * 100).toFixed(1)
      : "0";

  const metrics = [
    {
      label: "Documents Processed",
      value: formatNumber(stats.processed),
      sub: `of ${stats.total_documents.toLocaleString()} total`,
      icon: FileText,
      accent: "text-chart-5",
    },
    {
      label: "Unique Entities",
      value: formatNumber(stats.total_entities),
      sub: "People & organizations",
      icon: Users,
      accent: "text-gold",
    },
    {
      label: "Total Mentions",
      value: formatNumber(stats.total_mentions),
      sub: `Across ${stats.processed.toLocaleString()} docs`,
      icon: MessageSquareQuote,
      accent: "text-chart-2",
    },
    {
      label: "Processing Progress",
      value: `${processedPct}%`,
      sub: `${stats.processed} / ${stats.total_documents}`,
      icon: Activity,
      accent: stats.failed > 0 ? "text-destructive" : "text-chart-2",
      progress: parseFloat(processedPct),
    },
  ];

  return (
    <Card className="paper-grain border-border bg-card flex flex-col">
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Refresh button */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Key Metrics
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Metric rows */}
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/5 px-4 py-3"
          >
            <metric.icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${metric.accent} opacity-70`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-0.5 font-heading text-xl font-bold text-foreground">
                {metric.value}
              </p>
              <p className="text-[11px] text-muted-foreground">{metric.sub}</p>
              {metric.progress !== undefined && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-500"
                    style={{ width: `${metric.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Pipeline breakdown */}
        {stats.failed > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
            <p className="text-xs font-medium text-destructive">
              {stats.failed} documents failed processing
            </p>
          </div>
        )}

        {/* Last updated */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : "Loading..."}
        </div>
      </CardContent>
    </Card>
  );
}
