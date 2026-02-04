import { StatsCards } from "@/components/dashboard/StatsCards";
import { EntitySearch } from "@/components/dashboard/EntitySearch";
import { NameMentionChart } from "@/components/dashboard/NameMentionChart";
import { VisualizationTabs } from "@/components/dashboard/VisualizationTabs";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { RedactionAnalysis } from "@/components/dashboard/RedactionAnalysis";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Epstein Files <span className="text-gold-gradient">Analysis</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Named-entity extraction and document analysis from the DOJ Epstein
          Library. Data sourced from publicly released documents under FOIA.
        </p>
      </div>

      {/* Stats overview */}
      <ErrorBoundary fallbackTitle="Failed to load stats">
        <StatsCards />
      </ErrorBoundary>

      {/* Centerpiece — virtualized entity chart (full width) */}
      <ErrorBoundary fallbackTitle="Failed to load entity chart">
        <NameMentionChart />
      </ErrorBoundary>

      {/* Tabbed visualizations — Timeline / Document Types / Section Heatmap */}
      <ErrorBoundary fallbackTitle="Failed to load visualizations">
        <VisualizationTabs />
      </ErrorBoundary>

      {/* Network graph — full width */}
      <ErrorBoundary fallbackTitle="Failed to load network graph">
        <NetworkGraph />
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
