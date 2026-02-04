"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import type { ContextSnippet } from "@/lib/types";

function highlightName(text: string, name: string): React.ReactNode {
  if (!name) return text;
  const parts = text.split(new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === name.toLowerCase() ? (
      <span key={i} className="mention-highlight">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function ContextSnippets({
  snippets,
  entityName,
}: {
  snippets: ContextSnippet[];
  entityName: string;
}) {
  if (snippets.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No context snippets available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg font-bold">
          Context Snippets
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Excerpts from documents where this entity is mentioned
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        {snippets.map((s) => (
          <div
            key={s.id}
            className="rounded-md border border-border/50 bg-muted/20 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium">
                  {s.document_filename || "Unknown document"}
                </span>
                {s.page_number && (
                  <>
                    <span className="text-border">|</span>
                    <span>Page {s.page_number}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {s.extraction_method}
                </Badge>
                {s.confidence != null && (
                  <span className="text-[10px] text-muted-foreground">
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-secondary-foreground">
              &ldquo;{highlightName(s.context_snippet, entityName)}&rdquo;
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
