"use client";

import { memo, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentTypeBreakdown } from "@/lib/queries";

// ── Constants ───────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<string, string> = {
  court_filing: "#D4A843",
  email: "#4a8bc2",
  fbi_302: "#c25d4a",
  letter: "#5b8a72",
  memo: "#7c6e9b",
  report: "#E8C164",
  deposition: "#9b7cb8",
  foia_response: "#7cadb8",
  grand_jury: "#c4956a",
  fbi_memo: "#c25d4a",
  other: "#8892a4",
  unknown: "#6b7280",
};

function getDocTypeColor(dt: string): string {
  const normalized = dt.toLowerCase().replace(/[\s-]+/g, "_");
  return DOC_TYPE_COLORS[normalized] || DOC_TYPE_COLORS.other;
}

function formatDocType(dt: string): string {
  return dt
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Types ───────────────────────────────────────────────────────────

interface DocTypeChartProps {
  selectedDocType?: string | null;
  onSelectDocType?: (docType: string | null) => void;
}

interface DocTypeRow {
  doc_type: string;
  label: string;
  count: number;
}

// ── Component ───────────────────────────────────────────────────────

export const DocTypeChart = memo(function DocTypeChart({
  selectedDocType,
  onSelectDocType,
}: DocTypeChartProps) {
  const [data, setData] = useState<DocTypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocumentTypeBreakdown()
      .then((rows) => {
        setData(
          rows.map((r) => ({
            doc_type: r.doc_type,
            label: formatDocType(r.doc_type),
            count: r.count,
          }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalDocs = data.reduce((s, d) => s + d.count, 0);

  if (loading) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-bold">
            Document Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">
            No document type data available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleBarClick = (entry: DocTypeRow) => {
    if (onSelectDocType) {
      onSelectDocType(
        selectedDocType === entry.doc_type ? null : entry.doc_type
      );
    }
  };

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-bold">
          Document Type Breakdown
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {totalDocs.toLocaleString()} documents across{" "}
          {data.length} types
          {selectedDocType && (
            <span className="ml-2">
              &mdash; Filtered:{" "}
              <button
                onClick={() => onSelectDocType?.(null)}
                className="text-gold hover:underline"
              >
                {formatDocType(selectedDocType)} (clear)
              </button>
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 44)}>
          <BarChart
            data={data}
            layout="horizontal"
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2a3a"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#8892a4", fontSize: 11 }}
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
              formatter={(value) => [
                typeof value === "number"
                  ? `${value.toLocaleString()} documents`
                  : String(value),
                "Count",
              ]}
              labelFormatter={(label) => String(label)}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(barData) => {
                const entry = barData as unknown as DocTypeRow;
                if (entry?.doc_type) handleBarClick(entry);
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.doc_type}
                  fill={getDocTypeColor(entry.doc_type)}
                  fillOpacity={
                    selectedDocType && selectedDocType !== entry.doc_type
                      ? 0.25
                      : 0.85
                  }
                  stroke={
                    selectedDocType === entry.doc_type ? "#D4A843" : "none"
                  }
                  strokeWidth={selectedDocType === entry.doc_type ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Color legend */}
        <div className="mt-3 flex flex-wrap gap-3 border-t border-border/40 pt-3">
          {data.map((entry) => (
            <button
              key={entry.doc_type}
              onClick={() => handleBarClick(entry)}
              className={`flex items-center gap-1.5 text-[10px] transition-colors ${
                selectedDocType && selectedDocType !== entry.doc_type
                  ? "text-muted-foreground/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: getDocTypeColor(entry.doc_type) }}
              />
              {entry.label} ({entry.count})
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
