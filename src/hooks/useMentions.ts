"use client";

import { useCallback, useEffect, useState } from "react";
import { getContextSnippets } from "@/lib/queries";
import type { ContextSnippet, ContextSnippetParams } from "@/lib/types";

export function useMentions(entityId: string, initialParams: ContextSnippetParams = {}) {
  const [data, setData] = useState<ContextSnippet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<ContextSnippetParams>({
    limit: 20,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getContextSnippets(entityId, params);
      setData(result.data);
      setTotal(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch mentions");
    } finally {
      setLoading(false);
    }
  }, [entityId, params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateParams = useCallback((updates: Partial<ContextSnippetParams>) => {
    setParams((prev) => ({ ...prev, ...updates }));
  }, []);

  return { data, total, loading, error, params, updateParams, refetch: fetch };
}
