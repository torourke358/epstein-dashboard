"use client";

import { memo, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  getRedactionOverview,
  getRedactionBySection,
  getRedactionDistribution,
} from "@/lib/queries";

// ── Types ───────────────────────────────────────────────────────────

interface RedactionRow {
  document_id: string;
  filename: string;
  section: string;
  redaction_count: number;
  redaction_density: number;
  url?: string;
}

interface SectionRow {
  section: string;
  avg_density: number;
  total_redactions: number;
  doc_count: number;
}

interface DistributionRow {
  bucket: string;
  count: number;
}

// ── Tabs ────────────────────────────────────────────────────────────

const TABS = [
  { id: "density", label: "Density by Section" },
  { id: "distribution", label: "Distribution" },
  { id: "top-docs", label: "Most Redacted" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Helpers ─────────────────────────────────────────────────────────

function densityColor(density: number): string {
  if (density >= 0.1) return "#ef4444";
  if (density >= 0.05) return "#c25d4a";
  if (density >= 0.02) return "#D4A843";
  return "#5b8a72";
}

const SECTION_PALETTE = [
  "#D4A843",
  "#c25d4a",
  "#5b8a72",
  "#6b8cce",
  "#9b7cb8",
  "#c4956a",
  "#7cadb8",
  "#b85c7c",
];

// ── Sub-components ──────────────────────────────────────────────────

function DensityBySection({ data }: { data: SectionRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No redaction section data available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Average redaction density per page by DOJ document section
      </p>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fill: "#8892a4", fontSize: 11 }}
            axisLine={{ stroke: "#1e2a3a" }}
            tickLine={false}
            tickFormatter={(v) =>
              typeof v === "number" ? `${(v * 100).toFixed(1)}%` : ""
            }
          />
          <YAxis
            dataKey="section"
            type="category"
            width={140}
            tick={{ fill: "#cbd5e1", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#151921",
              border: "1px solid #1e2a3a",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0", fontWeight: 600 }}
            formatter={(value, _name, props) => {
              const row = props.payload as SectionRow;
              return [
                `${typeof value === "number" ? (value * 100).toFixed(2) : 0}% avg density (${row.doc_count} docs, ${row.total_redactions.toLocaleString()} redactions)`,
                "Section",
              ];
            }}
          />
          <Bar dataKey="avg_density" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((_, i) => (
              <Cell key={i} fill={SECTION_PALETTE[i % SECTION_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionHistogram({ data }: { data: DistributionRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No redaction distribution data available.
      </p>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Distribution of documents by number of redactions detected
        <span className="ml-2 text-foreground/60">
          ({total.toLocaleString()} documents total)
        </span>
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="bucket"
            tick={{ fill: "#8892a4", fontSize: 11 }}
            axisLine={{ stroke: "#1e2a3a" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8892a4", fontSize: 11 }}
            axisLine={{ stroke: "#1e2a3a" }}
            tickLine={false}
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
                : "0",
              "Redactions",
            ]}
            labelFormatter={(label) => `${label} redactions`}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
            {data.map((row, i) => (
              <Cell
                key={i}
                fill={
                  row.bucket === "0"
                    ? "#5b8a72"
                    : row.bucket === "250+"
                      ? "#ef4444"
                      : "#D4A843"
                }
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MostRedactedTable({ data }: { data: RedactionRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No redacted documents found.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Top 20 documents with highest redaction density
      </p>
      <div className="overflow-x-auto rounded border border-border/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 bg-muted/10">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Document
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Section
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Redactions
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Density
              </th>
              <th className="px-3 py-2 w-28">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.document_id}
                className="border-t border-border/20 transition-colors hover:bg-muted/5"
              >
                <td className="px-3 py-2 max-w-[240px]">
                  <span className="truncate block text-foreground font-medium">
                    {row.filename}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.section}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {row.redaction_count.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  <span style={{ color: densityColor(row.redaction_density) }}>
                    {(row.redaction_density * 100).toFixed(2)}%
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(row.redaction_density * 100 * 5, 100)}%`,
                        backgroundColor: densityColor(row.redaction_density),
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Heavy (>10%)", color: "#ef4444" },
          { label: "Moderate (5-10%)", color: "#c25d4a" },
          { label: "Light (2-5%)", color: "#D4A843" },
          { label: "Minimal (<2%)", color: "#5b8a72" },
        ].map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export const RedactionAnalysis = memo(function RedactionAnalysis() {
  const [activeTab, setActiveTab] = useState<TabId>("density");
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(true);

  // Data for each tab
  const [sectionData, setSectionData] = useState<SectionRow[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionRow[]>(
    []
  );
  const [topDocs, setTopDocs] = useState<RedactionRow[]>([]);

  useEffect(() => {
    Promise.all([
      getRedactionBySection(),
      getRedactionDistribution(),
      getRedactionOverview(),
    ])
      .then(([sections, distribution, overview]) => {
        if (
          sections.length === 0 &&
          distribution.every((d) => d.count === 0) &&
          overview.length === 0
        ) {
          setHasData(false);
          return;
        }
        setSectionData(sections);
        setDistributionData(distribution);
        setTopDocs(
          overview.slice(0, 20).map((d) => ({
            document_id: d.document_id,
            filename: d.document_filename,
            section: d.document_section.replace("/epstein/", ""),
            redaction_count: d.redaction_count,
            redaction_density: d.redaction_density,
          }))
        );
      })
      .catch((err) => {
        console.error("RedactionAnalysis:", err);
        setHasData(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg font-bold">
            Redaction Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-12 text-center text-sm text-muted-foreground">
            No redaction data available. Run the extraction pipeline to detect
            redacted content in documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalRedactions = topDocs.reduce((s, r) => s + r.redaction_count, 0);
  const totalAnalyzed = distributionData.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="font-heading text-lg font-bold">
            Redaction Analysis
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {totalAnalyzed.toLocaleString()} docs analyzed
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {totalRedactions.toLocaleString()} redactions (top 20)
            </Badge>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-2 flex gap-1 rounded-lg bg-muted/30 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === "density" && <DensityBySection data={sectionData} />}
        {activeTab === "distribution" && (
          <DistributionHistogram data={distributionData} />
        )}
        {activeTab === "top-docs" && <MostRedactedTable data={topDocs} />}
      </CardContent>
    </Card>
  );
});
