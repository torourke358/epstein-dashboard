"use client";

import { useState } from "react";
import { TopEntities } from "@/components/dashboard/TopEntities";
import { StatsPanel } from "@/components/dashboard/StatsPanel";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { DocTypeChart } from "@/components/dashboard/DocTypeChart";
import { DocTypeHeatmap } from "@/components/dashboard/DocTypeHeatmap";
import { SearchFilter } from "@/components/dashboard/SearchFilter";
import { RedactionAnalysis } from "@/components/dashboard/RedactionAnalysis";
import { EntitySearch } from "@/components/dashboard/EntitySearch";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardPage() {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Page heading + Search/Filter bar ─────────────────────── */}
      <div className="space-y-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Epstein Files{" "}
            <span className="text-gold-gradient">Analysis</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Named-entity extraction and document analysis from the DOJ
            Epstein Library. Data sourced from publicly released documents
            under FOIA.
          </p>
        </div>
        <SearchFilter
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedDocType={selectedDocType}
          onDocTypeChange={setSelectedDocType}
        />
      </div>

      {/* ── Above the Fold: Top Entities (60%) + Stats (40%) ────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <ErrorBoundary fallbackTitle="Failed to load top entities">
          <TopEntities
            selectedEntityId={selectedEntityId}
            onSelectEntity={setSelectedEntityId}
            selectedDocType={selectedDocType}
          />
        </ErrorBoundary>
        <ErrorBoundary fallbackTitle="Failed to load stats">
          <StatsPanel />
        </ErrorBoundary>
      </div>

      {/* ── Below the Fold ───────────────────────────────────────── */}

      {/* Network Graph — full width */}
      <ErrorBoundary fallbackTitle="Failed to load network graph">
        <NetworkGraph />
      </ErrorBoundary>

      {/* Document Type Bar Chart — full width */}
      <ErrorBoundary fallbackTitle="Failed to load document type chart">
        <DocTypeChart
          selectedDocType={selectedDocType}
          onSelectDocType={setSelectedDocType}
        />
      </ErrorBoundary>

      {/* Document Type Heatmap — full width */}
      <ErrorBoundary fallbackTitle="Failed to load heatmap">
        <DocTypeHeatmap
          selectedEntityId={selectedEntityId}
          selectedDocType={selectedDocType}
        />
      </ErrorBoundary>

      {/* Redaction analysis */}
      <ErrorBoundary fallbackTitle="Failed to load redaction analysis">
        <RedactionAnalysis />
      </ErrorBoundary>

      {/* Entity search / index */}
      <ErrorBoundary fallbackTitle="Failed to load entity search">
        <EntitySearch />
      </ErrorBoundary>
    </div>
  );
}
