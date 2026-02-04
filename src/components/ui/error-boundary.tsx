"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-heading text-sm font-bold text-foreground">
                {this.props.fallbackTitle || "Something went wrong"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="mt-2 flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
