"use client";

import { useCallback, useEffect, useState } from "react";
import { getDocuments } from "@/lib/queries";
import type { Document, DocumentParams } from "@/lib/types";

export function useDocuments(initialParams: DocumentParams = {}) {
  const [data, setData] = useState<Document[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<DocumentParams>({
    limit: 50,
    offset: 0,
    ...initialParams,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDocuments(params);
      setData(result.data);
      setCount(result.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateParams = useCallback((updates: Partial<DocumentParams>) => {
    setParams((prev) => ({ ...prev, ...updates }));
  }, []);

  return { data, count, loading, error, params, updateParams, refetch: fetch };
}
