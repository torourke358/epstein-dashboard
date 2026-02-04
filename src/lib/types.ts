// ── Database row types ───────────────────────────────────────────────

export interface Document {
  id: string;
  url: string;
  filename: string;
  section: string;
  file_size_bytes: number | null;
  page_count: number | null;
  text_length: number | null;
  doc_type: string | null;
  is_ocr: boolean | null;
  status: string;
  discovered_at: string | null;
  downloaded_at: string | null;
  extracted_at: string | null;
  processed_at: string | null;
  error_message: string | null;
}

export interface Entity {
  id: string;
  canonical_name: string;
  aliases: string[];
  entity_type: string;
  notes: string | null;
  created_at: string;
}

export interface Mention {
  id: string;
  document_id: string;
  entity_id: string;
  raw_text: string;
  context_snippet: string;
  page_number: number | null;
  char_offset: number | null;
  extraction_method: string;
  confidence: number | null;
  created_at: string;
}

export interface RedactionStat {
  id: string;
  document_id: string;
  redaction_count: number;
  redaction_density: number;
  created_at: string;
}

// ── Materialized view ────────────────────────────────────────────────

export interface EntityMentionCount {
  entity_id: string;
  canonical_name: string;
  aliases: string[];
  entity_type: string;
  total_mentions: number;
  unique_documents: number;
  sections: string[];
  doc_types: string[];
  first_seen: string | null;
  last_seen: string | null;
}

// ── RPC return types ─────────────────────────────────────────────────

export interface DashboardStats {
  total_documents: number;
  discovered: number;
  downloaded: number;
  extracted: number;
  processed: number;
  failed: number;
  total_entities: number;
  total_mentions: number;
  total_text_length: number;
}

export interface CoMention {
  entity_a_id: string;
  entity_a_name: string;
  entity_b_id: string;
  entity_b_name: string;
  co_occurrence_count: number;
  shared_documents: number;
}

export interface SectionBreakdown {
  section: string;
  mention_count: number;
}

export interface EntitySearchResult {
  id: string;
  canonical_name: string;
  aliases: string[];
  entity_type: string;
  similarity: number;
}

// ── Component prop types ─────────────────────────────────────────────

export interface ContextSnippet {
  id: string;
  raw_text: string;
  context_snippet: string;
  page_number: number | null;
  char_offset: number | null;
  extraction_method: string;
  confidence: number | null;
  document_id: string;
  document_filename?: string;
  document_section?: string;
  document_doc_type?: string;
  document_url?: string;
}

export interface EntityDocument {
  document_id: string;
  filename: string;
  section: string;
  doc_type: string | null;
  url: string;
  discovered_at: string | null;
  mention_count: number;
}

export interface EntityDetail extends Entity {
  total_mentions: number;
  unique_documents: number;
  sections: string[];
  doc_types: string[];
}

// ── Query parameter types ────────────────────────────────────────────

export interface EntityMentionParams {
  search?: string;
  sortBy?: "total_mentions" | "unique_documents" | "canonical_name";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  section?: string;
  minMentions?: number;
}

export interface DocumentParams {
  section?: string;
  docType?: string;
  search?: string;
  status?: string;
  sortBy?: "filename" | "section" | "doc_type" | "page_count" | "text_length";
  sortOrder?: "asc" | "desc";
  isOcr?: boolean;
  hasMentions?: boolean;
  limit?: number;
  offset?: number;
}

export interface DocumentTextPreview {
  document_id: string;
  text: string;
}

export interface DocumentEntityRow {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  mention_count: number;
}

export interface SharedDocumentPair {
  entity_a_id: string;
  entity_a_name: string;
  entity_b_id: string;
  entity_b_name: string;
  shared_count: number;
}

export interface ContextSnippetParams {
  limit?: number;
  offset?: number;
  documentId?: string;
  section?: string;
  docType?: string;
  extractionMethod?: string;
  search?: string;
}
