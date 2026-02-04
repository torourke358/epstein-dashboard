import { ComparisonTool } from "@/components/compare/ComparisonTool";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Entity <span className="text-gold-gradient">Comparison</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare entities side-by-side to explore overlapping documents,
          mention patterns, and document type distributions.
        </p>
      </div>
      <ErrorBoundary fallbackTitle="Failed to load comparison tool">
        <ComparisonTool />
      </ErrorBoundary>
    </div>
  );
}
