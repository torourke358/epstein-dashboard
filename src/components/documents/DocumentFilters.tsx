"use client";

import { Button } from "@/components/ui/button";
import type { DocumentParams } from "@/lib/types";

const STATUSES = ["discovered", "downloaded", "extracted", "processed", "failed"];

export function DocumentFilters({
  params,
  onUpdate,
}: {
  params: DocumentParams;
  onUpdate: (updates: Partial<DocumentParams>) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        variant={params.status ? "ghost" : "secondary"}
        size="sm"
        className="h-8 text-xs"
        onClick={() => onUpdate({ status: undefined, offset: 0 })}
      >
        All
      </Button>
      {STATUSES.map((s) => (
        <Button
          key={s}
          variant={params.status === s ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs capitalize"
          onClick={() =>
            onUpdate({ status: params.status === s ? undefined : s, offset: 0 })
          }
        >
          {s}
        </Button>
      ))}
    </div>
  );
}
