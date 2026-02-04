import { supabase } from "./supabase";
import type {
  CoMention,
  ContextSnippet,
  ContextSnippetParams,
  DashboardStats,
  Document,
  DocumentEntityRow,
  DocumentParams,
  DocumentTextPreview,
  EntityDetail,
  EntityDocument,
  EntityMentionCount,
  EntityMentionParams,
  EntitySearchResult,
  SectionBreakdown,
} from "./types";

// ── Dashboard stats via RPC ──────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("get_pipeline_status");
  if (error) throw error;
  // RPC returns a single row (or an array with one object)
  const row = Array.isArray(data) ? data[0] : data;
  return row as DashboardStats;
}

// ── Entity mention counts (materialized view) ────────────────────────

export async function getEntityMentions(
  params: EntityMentionParams = {}
): Promise<{ data: EntityMentionCount[]; count: number }> {
  const {
    search,
    sortBy = "total_mentions",
    sortOrder = "desc",
    limit = 25,
    offset = 0,
    section,
    minMentions,
  } = params;

  // If searching, use the RPC
  if (search && search.trim().length > 0) {
    const { data, error } = await supabase.rpc("search_entities", {
      search_term: search.trim(),
      result_limit: limit,
    });
    if (error) throw error;
    // search_entities returns entity rows; enrich from the view
    const ids = (data || []).map((r: { id: string }) => r.id);
    if (ids.length === 0) return { data: [], count: 0 };

    const { data: viewData, error: viewErr } = await supabase
      .from("entity_mention_counts")
      .select("*")
      .in("entity_id", ids)
      .order(sortBy, { ascending: sortOrder === "asc" });
    if (viewErr) throw viewErr;
    return { data: viewData || [], count: viewData?.length || 0 };
  }

  // Direct query on the materialized view
  let query = supabase
    .from("entity_mention_counts")
    .select("*", { count: "exact" });

  if (section) {
    query = query.contains("sections", [section]);
  }
  if (minMentions && minMentions > 0) {
    query = query.gte("total_mentions", minMentions);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ── Entity detail ────────────────────────────────────────────────────

export async function getEntityDetails(
  entityId: string
): Promise<EntityDetail | null> {
  // Fetch base entity
  const { data: entity, error: entErr } = await supabase
    .from("entities")
    .select("*")
    .eq("id", entityId)
    .single();
  if (entErr) throw entErr;
  if (!entity) return null;

  // Fetch aggregated stats from the materialized view
  const { data: stats } = await supabase
    .from("entity_mention_counts")
    .select("total_mentions, unique_documents, sections, doc_types")
    .eq("entity_id", entityId)
    .single();

  return {
    ...entity,
    total_mentions: stats?.total_mentions || 0,
    unique_documents: stats?.unique_documents || 0,
    sections: stats?.sections || [],
    doc_types: stats?.doc_types || [],
  } as EntityDetail;
}

// ── Context snippets for an entity ───────────────────────────────────

export async function getContextSnippets(
  entityId: string,
  params: ContextSnippetParams = {}
): Promise<{ data: ContextSnippet[]; count: number }> {
  const {
    limit = 20,
    offset = 0,
    documentId,
    section,
    docType,
    extractionMethod,
    search,
  } = params;

  let query = supabase
    .from("mentions")
    .select(
      "id, raw_text, context_snippet, page_number, char_offset, extraction_method, confidence, document_id, documents!inner(filename, section, doc_type, url)",
      { count: "exact" }
    )
    .eq("entity_id", entityId)
    .order("confidence", { ascending: false })
    .range(offset, offset + limit - 1);

  if (documentId) query = query.eq("document_id", documentId);
  if (section) query = query.eq("documents.section", section);
  if (docType) query = query.eq("documents.doc_type", docType);
  if (extractionMethod) query = query.eq("extraction_method", extractionMethod);
  if (search) query = query.ilike("context_snippet", `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: (data || []).map((row: Record<string, unknown>) => {
      const doc = row.documents as Record<string, string> | null;
      return {
        id: row.id as string,
        raw_text: row.raw_text as string,
        context_snippet: row.context_snippet as string,
        page_number: row.page_number as number | null,
        char_offset: row.char_offset as number | null,
        extraction_method: row.extraction_method as string,
        confidence: row.confidence as number | null,
        document_id: row.document_id as string,
        document_filename: doc?.filename,
        document_section: doc?.section,
        document_doc_type: doc?.doc_type,
        document_url: doc?.url,
      };
    }),
    count: count || 0,
  };
}

// ── Documents mentioning an entity ──────────────────────────────────

export async function getEntityDocuments(
  entityId: string
): Promise<EntityDocument[]> {
  const { data: mentions, error } = await supabase
    .from("mentions")
    .select("document_id")
    .eq("entity_id", entityId);
  if (error) throw error;

  const countMap = new Map<string, number>();
  for (const row of mentions || []) {
    const id = row.document_id as string;
    countMap.set(id, (countMap.get(id) || 0) + 1);
  }
  if (countMap.size === 0) return [];

  const docIds = Array.from(countMap.keys());
  const allDocs: Record<string, unknown>[] = [];
  for (let i = 0; i < docIds.length; i += 100) {
    const batch = docIds.slice(i, i + 100);
    const { data: docs, error: docErr } = await supabase
      .from("documents")
      .select("id, filename, section, doc_type, url, discovered_at")
      .in("id", batch);
    if (docErr) throw docErr;
    allDocs.push(...((docs as Record<string, unknown>[]) || []));
  }

  return allDocs
    .map((doc) => ({
      document_id: doc.id as string,
      filename: doc.filename as string,
      section: doc.section as string,
      doc_type: (doc.doc_type as string) || null,
      url: doc.url as string,
      discovered_at: (doc.discovered_at as string) || null,
      mention_count: countMap.get(doc.id as string) || 0,
    }))
    .sort((a, b) => b.mention_count - a.mention_count);
}

// ── Co-mentions for a specific entity ───────────────────────────────

export async function getEntityCoMentions(
  entityId: string
): Promise<
  {
    entity_id: string;
    entity_name: string;
    shared_documents: number;
    co_occurrences: number;
  }[]
> {
  // Try dedicated RPC first
  const { data, error } = await supabase.rpc("get_shared_documents", {
    target_entity_id: entityId,
  });

  if (!error && data && Array.isArray(data) && data.length > 0) {
    return (data as Record<string, unknown>[]).map((row) => ({
      entity_id: (row.entity_id || row.other_entity_id) as string,
      entity_name:
        (row.entity_name || row.canonical_name || row.other_entity_name) as string,
      shared_documents:
        ((row.shared_documents || row.shared_docs) as number) || 0,
      co_occurrences:
        ((row.co_occurrences || row.co_occurrence_count) as number) || 0,
    }));
  }

  // Fallback: filter from global co-mentions
  const all = await getCoMentions({ minCoOccurrences: 1, limit: 500 });
  return all
    .filter(
      (cm) => cm.entity_a_id === entityId || cm.entity_b_id === entityId
    )
    .map((cm) => {
      const isA = cm.entity_a_id === entityId;
      return {
        entity_id: isA ? cm.entity_b_id : cm.entity_a_id,
        entity_name: isA ? cm.entity_b_name : cm.entity_a_name,
        shared_documents: cm.shared_documents,
        co_occurrences: cm.co_occurrence_count,
      };
    })
    .sort((a, b) => b.co_occurrences - a.co_occurrences);
}

// ── Documents ────────────────────────────────────────────────────────

export async function getDocuments(
  params: DocumentParams = {}
): Promise<{ data: Document[]; count: number }> {
  const {
    section,
    docType,
    search,
    status,
    sortBy = "discovered_at" as string,
    sortOrder = "desc",
    isOcr,
    hasMentions,
    limit = 50,
    offset = 0,
  } = params;

  // When hasMentions filter is active, we need a different approach:
  // fetch document IDs that have at least one mention first
  let mentionDocIds: string[] | null = null;
  if (hasMentions === true) {
    const { data: mentionRows, error: mErr } = await supabase
      .from("mentions")
      .select("document_id");
    if (mErr) throw mErr;
    mentionDocIds = [
      ...new Set((mentionRows || []).map((r) => r.document_id as string)),
    ];
    if (mentionDocIds.length === 0)
      return { data: [], count: 0 };
  }

  let query = supabase.from("documents").select("*", { count: "exact" });

  if (section) query = query.eq("section", section);
  if (docType) query = query.eq("doc_type", docType);
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("filename", `%${search}%`);
  if (isOcr !== undefined) query = query.eq("is_ocr", isOcr);
  if (mentionDocIds) query = query.in("id", mentionDocIds);

  const orderCol =
    sortBy === "discovered_at" ? "discovered_at" : sortBy;
  query = query
    .order(orderCol, { ascending: sortOrder === "asc", nullsFirst: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

// ── Document text preview ───────────────────────────────────────────

export async function getDocumentTextPreview(
  documentId: string
): Promise<DocumentTextPreview | null> {
  const { data, error } = await supabase
    .from("document_texts")
    .select("document_id, extracted_text")
    .eq("document_id", documentId)
    .single();
  if (error) return null;
  if (!data) return null;
  const full = (data.extracted_text as string) || "";
  return {
    document_id: data.document_id as string,
    text: full.slice(0, 500),
  };
}

// ── Entities mentioned in a document ────────────────────────────────

export async function getDocumentEntities(
  documentId: string
): Promise<DocumentEntityRow[]> {
  const { data: mentions, error } = await supabase
    .from("mentions")
    .select("entity_id")
    .eq("document_id", documentId);
  if (error) throw error;

  const countMap = new Map<string, number>();
  for (const row of mentions || []) {
    const id = row.entity_id as string;
    countMap.set(id, (countMap.get(id) || 0) + 1);
  }
  if (countMap.size === 0) return [];

  const entityIds = Array.from(countMap.keys());
  const allEntities: Record<string, unknown>[] = [];
  for (let i = 0; i < entityIds.length; i += 100) {
    const batch = entityIds.slice(i, i + 100);
    const { data: entities, error: eErr } = await supabase
      .from("entities")
      .select("id, canonical_name, entity_type")
      .in("id", batch);
    if (eErr) throw eErr;
    allEntities.push(...((entities as Record<string, unknown>[]) || []));
  }

  return allEntities
    .map((e) => ({
      entity_id: e.id as string,
      canonical_name: e.canonical_name as string,
      entity_type: e.entity_type as string,
      mention_count: countMap.get(e.id as string) || 0,
    }))
    .sort((a, b) => b.mention_count - a.mention_count);
}

// ── Redaction density by section ────────────────────────────────────

export async function getRedactionBySection(): Promise<
  { section: string; avg_density: number; total_redactions: number; doc_count: number }[]
> {
  const { data, error } = await supabase
    .from("redaction_stats")
    .select("redaction_count, redaction_density, documents(section)");
  if (error) throw error;

  const grouped = new Map<
    string,
    { totalDensity: number; totalCount: number; docs: number }
  >();
  for (const row of (data as Record<string, unknown>[]) || []) {
    const doc = row.documents as Record<string, string> | null;
    const section = doc?.section || "unknown";
    const prev = grouped.get(section) || {
      totalDensity: 0,
      totalCount: 0,
      docs: 0,
    };
    grouped.set(section, {
      totalDensity: prev.totalDensity + (row.redaction_density as number),
      totalCount: prev.totalCount + (row.redaction_count as number),
      docs: prev.docs + 1,
    });
  }

  return Array.from(grouped.entries())
    .map(([section, v]) => ({
      section: section.replace("/epstein/", ""),
      avg_density: v.docs > 0 ? v.totalDensity / v.docs : 0,
      total_redactions: v.totalCount,
      doc_count: v.docs,
    }))
    .sort((a, b) => b.avg_density - a.avg_density);
}

// ── Redaction distribution (histogram) ──────────────────────────────

export async function getRedactionDistribution(): Promise<
  { bucket: string; count: number }[]
> {
  const { data, error } = await supabase
    .from("redaction_stats")
    .select("redaction_count");
  if (error) throw error;

  const buckets = [
    { label: "0", min: 0, max: 0 },
    { label: "1-5", min: 1, max: 5 },
    { label: "6-10", min: 6, max: 10 },
    { label: "11-25", min: 11, max: 25 },
    { label: "26-50", min: 26, max: 50 },
    { label: "51-100", min: 51, max: 100 },
    { label: "101-250", min: 101, max: 250 },
    { label: "250+", min: 251, max: Infinity },
  ];

  const counts = new Map<string, number>();
  for (const b of buckets) counts.set(b.label, 0);

  for (const row of data || []) {
    const val = row.redaction_count as number;
    for (const b of buckets) {
      if (val >= b.min && val <= b.max) {
        counts.set(b.label, (counts.get(b.label) || 0) + 1);
        break;
      }
    }
  }

  return buckets.map((b) => ({
    bucket: b.label,
    count: counts.get(b.label) || 0,
  }));
}

// ── Distinct doc types ──────────────────────────────────────────────

export async function getDistinctDocTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("doc_type");
  if (error) throw error;

  const types = new Set<string>();
  for (const row of data || []) {
    if (row.doc_type) types.add(row.doc_type as string);
  }
  return Array.from(types).sort();
}

// ── Co-mentions via RPC ──────────────────────────────────────────────

export async function getCoMentions(params: {
  minCoOccurrences?: number;
  limit?: number;
}): Promise<CoMention[]> {
  const { minCoOccurrences = 3, limit = 50 } = params;
  const { data, error } = await supabase.rpc("get_co_mentions", {
    min_co_occurrences: minCoOccurrences,
    result_limit: limit,
  });
  if (error) throw error;
  return (data || []) as CoMention[];
}

// ── Entity section breakdown via RPC ─────────────────────────────────

export async function getEntitySectionBreakdown(
  entityId: string
): Promise<SectionBreakdown[]> {
  const { data, error } = await supabase.rpc("get_entity_section_breakdown", {
    target_entity_id: entityId,
  });
  if (error) throw error;
  return (data || []) as SectionBreakdown[];
}

// ── Chart data (ILIKE search, proper pagination) ────────────────────

export async function fetchEntityChartData(params: {
  search?: string;
  sortBy?: "total_mentions" | "unique_documents" | "canonical_name";
  sortOrder?: "asc" | "desc";
  minMentions?: number;
  section?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: EntityMentionCount[]; count: number }> {
  const {
    search,
    sortBy = "total_mentions",
    sortOrder = "desc",
    minMentions,
    section,
    limit = 100,
    offset = 0,
  } = params;

  let query = supabase
    .from("entity_mention_counts")
    .select("*", { count: "exact" });

  if (search && search.trim().length > 0) {
    query = query.ilike("canonical_name", `%${search.trim()}%`);
  }
  if (section) {
    query = query.contains("sections", [section]);
  }
  if (minMentions && minMentions > 0) {
    query = query.gte("total_mentions", minMentions);
  }

  query = query
    .order(sortBy, { ascending: sortOrder === "asc" })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getDistinctSections(): Promise<string[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("section");
  if (error) throw error;

  const sections = new Set<string>();
  for (const row of data || []) {
    if (row.section) sections.add(row.section as string);
  }
  return Array.from(sections).sort();
}

// ── Timeline / doc-type / heatmap helpers ───────────────────────────

/** Fetch mentions with document discovered_at dates for selected entities. */
export async function getTimelineMentions(
  entityIds: string[]
): Promise<{ entity_id: string; date: string }[]> {
  const PAGE = 1000;
  const all: { entity_id: string; date: string }[] = [];

  // First page + count
  const { data: first, error, count } = await supabase
    .from("mentions")
    .select("entity_id, documents!inner(discovered_at)", { count: "exact" })
    .in("entity_id", entityIds)
    .range(0, PAGE - 1);
  if (error) throw error;

  const extract = (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const doc = row.documents as Record<string, string> | null;
      const d = doc?.discovered_at?.slice(0, 10);
      if (d) all.push({ entity_id: row.entity_id as string, date: d });
    }
  };
  extract((first as Record<string, unknown>[]) || []);

  // Remaining pages in parallel (cap at 10k)
  const total = Math.min(count || 0, 10000);
  if (total > PAGE) {
    const fetches: Promise<void>[] = [];
    for (let off = PAGE; off < total; off += PAGE) {
      fetches.push(
        Promise.resolve(
          supabase
            .from("mentions")
            .select("entity_id, documents!inner(discovered_at)")
            .in("entity_id", entityIds)
            .range(off, off + PAGE - 1)
        ).then(({ data: page }) => {
          extract((page as Record<string, unknown>[]) || []);
        })
      );
    }
    await Promise.allSettled(fetches);
  }
  return all;
}

/** Fetch mentions with document doc_type for selected entities. */
export async function getEntityDocTypeData(
  entityIds: string[]
): Promise<{ entity_id: string; doc_type: string }[]> {
  const PAGE = 1000;
  const all: { entity_id: string; doc_type: string }[] = [];

  const { data: first, error, count } = await supabase
    .from("mentions")
    .select("entity_id, documents!inner(doc_type)", { count: "exact" })
    .in("entity_id", entityIds)
    .range(0, PAGE - 1);
  if (error) throw error;

  const extract = (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const doc = row.documents as Record<string, string> | null;
      all.push({
        entity_id: row.entity_id as string,
        doc_type: doc?.doc_type || "unknown",
      });
    }
  };
  extract((first as Record<string, unknown>[]) || []);

  const total = Math.min(count || 0, 10000);
  if (total > PAGE) {
    const fetches: Promise<void>[] = [];
    for (let off = PAGE; off < total; off += PAGE) {
      fetches.push(
        Promise.resolve(
          supabase
            .from("mentions")
            .select("entity_id, documents!inner(doc_type)")
            .in("entity_id", entityIds)
            .range(off, off + PAGE - 1)
        ).then(({ data: page }) => {
          extract((page as Record<string, unknown>[]) || []);
        })
      );
    }
    await Promise.allSettled(fetches);
  }
  return all;
}

/** Batch-fetch section breakdowns for multiple entities via parallel RPCs. */
export async function batchSectionBreakdowns(
  entityIds: string[]
): Promise<Map<string, SectionBreakdown[]>> {
  const results = await Promise.allSettled(
    entityIds.map((id) =>
      getEntitySectionBreakdown(id).then(
        (data) => [id, data] as const
      )
    )
  );
  const map = new Map<string, SectionBreakdown[]>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      map.set(r.value[0], r.value[1]);
    }
  }
  return map;
}

// ── Visualization helpers ───────────────────────────────────────────

export async function getDocumentTypeBreakdown(): Promise<
  { doc_type: string; count: number }[]
> {
  const { data, error } = await supabase
    .from("documents")
    .select("doc_type");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data || []) {
    const key = (row.doc_type as string) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([doc_type, count]) => ({ doc_type, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getDocumentSectionBreakdown(): Promise<
  { section: string; count: number }[]
> {
  const { data, error } = await supabase
    .from("documents")
    .select("section");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data || []) {
    const key = (row.section as string) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([section, count]) => ({ section, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getRedactionOverview(): Promise<
  {
    document_id: string;
    document_filename: string;
    document_section: string;
    redaction_count: number;
    redaction_density: number;
  }[]
> {
  const { data, error } = await supabase
    .from("redaction_stats")
    .select(
      "document_id, redaction_count, redaction_density, documents(filename, section)"
    )
    .order("redaction_density", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => {
    const doc = row.documents as Record<string, string> | null;
    return {
      document_id: row.document_id as string,
      document_filename: doc?.filename || "unknown",
      document_section: doc?.section || "unknown",
      redaction_count: row.redaction_count as number,
      redaction_density: row.redaction_density as number,
    };
  });
}

export async function getEntityTypeBreakdown(): Promise<
  { entity_type: string; count: number; total_mentions: number }[]
> {
  const { data, error } = await supabase
    .from("entity_mention_counts")
    .select("entity_type, total_mentions");
  if (error) throw error;

  const grouped = new Map<
    string,
    { count: number; total_mentions: number }
  >();
  for (const row of data || []) {
    const key = (row.entity_type as string) || "unknown";
    const prev = grouped.get(key) || { count: 0, total_mentions: 0 };
    grouped.set(key, {
      count: prev.count + 1,
      total_mentions: prev.total_mentions + ((row.total_mentions as number) || 0),
    });
  }
  return Array.from(grouped.entries())
    .map(([entity_type, v]) => ({ entity_type, ...v }))
    .sort((a, b) => b.total_mentions - a.total_mentions);
}

// ── Comparison queries ──────────────────────────────────────────────

/** Fetch entity_mention_counts rows for a set of entity IDs. */
export async function getComparisonStats(
  entityIds: string[]
): Promise<EntityMentionCount[]> {
  const { data, error } = await supabase
    .from("entity_mention_counts")
    .select("*")
    .in("entity_id", entityIds);
  if (error) throw error;
  return (data || []) as EntityMentionCount[];
}

/** Search documents by filename for global search. */
export async function searchDocuments(
  search: string,
  limit = 5
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .ilike("filename", `%${search.trim()}%`)
    .order("discovered_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Document[];
}

/** Search entities via the search_entities RPC. */
export async function searchEntities(
  searchTerm: string,
  limit = 10
): Promise<EntitySearchResult[]> {
  const { data, error } = await supabase.rpc("search_entities", {
    search_term: searchTerm.trim(),
    result_limit: limit,
  });
  if (error) throw error;
  return (data || []) as EntitySearchResult[];
}
