"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionTimeline } from "./MentionTimeline";
import { DocumentTypeBreakdown } from "./DocumentTypeBreakdown";
import { SectionHeatmap } from "./SectionHeatmap";

// ── Tab definitions ────────────────────────────────────────────────

const TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "doctypes", label: "Document Types" },
  { id: "heatmap", label: "Section Heatmap" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Component ──────────────────────────────────────────────────────

export function VisualizationTabs() {
  const [active, setActive] = useState<TabId>("timeline");

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-bold">
          Entity Analysis
        </CardTitle>
        <div className="mt-2 flex gap-1 rounded-lg bg-muted/30 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active === tab.id
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
        {active === "timeline" && <MentionTimeline />}
        {active === "doctypes" && <DocumentTypeBreakdown />}
        {active === "heatmap" && <SectionHeatmap />}
      </CardContent>
    </Card>
  );
}
