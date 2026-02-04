"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCoMentions } from "@/lib/queries";

interface CoEntity {
  id: string;
  name: string;
  coOccurrences: number;
  sharedDocs: number;
}

export function EntityComparison({ entityId }: { entityId: string }) {
  const [coEntities, setCoEntities] = useState<CoEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCoMentions({ minCoOccurrences: 1, limit: 100 })
      .then((data) => {
        // Filter to co-mentions involving this entity
        const related: CoEntity[] = [];
        for (const cm of data) {
          if (cm.entity_a_id === entityId) {
            related.push({
              id: cm.entity_b_id,
              name: cm.entity_b_name,
              coOccurrences: cm.co_occurrence_count,
              sharedDocs: cm.shared_documents,
            });
          } else if (cm.entity_b_id === entityId) {
            related.push({
              id: cm.entity_a_id,
              name: cm.entity_a_name,
              coOccurrences: cm.co_occurrence_count,
              sharedDocs: cm.shared_documents,
            });
          }
        }
        related.sort((a, b) => b.coOccurrences - a.coOccurrences);
        setCoEntities(related.slice(0, 15));
      })
      .catch((err) => console.error("EntityComparison:", err))
      .finally(() => setLoading(false));
  }, [entityId]);

  if (loading) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (coEntities.length === 0) {
    return (
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-lg font-bold">
            Related Entities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No co-mentioned entities found.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxCo = coEntities[0]?.coOccurrences || 1;

  return (
    <Card className="paper-grain border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gold opacity-60" />
          <CardTitle className="font-heading text-lg font-bold">
            Related Entities
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Entities co-mentioned in the same documents
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {coEntities.map((ce) => (
          <Link
            key={ce.id}
            href={`/entity/${ce.id}`}
            className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/20"
          >
            {/* Bar indicator */}
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${(ce.coOccurrences / maxCo) * 100}%` }}
              />
            </div>
            <span className="flex-1 truncate text-sm text-foreground group-hover:text-gold transition-colors">
              {ce.name}
            </span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {ce.coOccurrences} co-mentions
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {ce.sharedDocs} docs
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
