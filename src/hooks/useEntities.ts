"use client";

import { useCallback, useEffect, useState } from "react";
import { getEntityMentions } from "@/lib/queries";
import type { EntityMentionCount, EntityMentionParams } from "@/lib/types";

export function useEntities(initialParams: EntityMentionParams = {}) {
  const [data, setData] = useState<EntityMentionCount[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<EntityMentionParams>({
    sortBy: "total_mentions",
    sortOrder: "desc",
    limit: 25,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEntityMentions(params);
      setData(result.data);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch entities");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateParams = useCallback((updates: Partial<EntityMentionParams>) => {
    setParams((prev) => ({ ...prev, ...updates }));
  }, []);

  return { data, count, loading, error, params, updateParams, refetch: fetch };
}
