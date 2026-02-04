"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Hash, Layers, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getEntityDetails } from "@/lib/queries";
import type { EntityDetail } from "@/lib/types";
import { ContextSnippetsTab } from "./ContextSnippetsTab";
import { DocumentsTab } from "./DocumentsTab";
import { CoMentionsTab } from "./CoMentionsTab";

// ── Tab definitions ────────────────────────────────────────────────

const TABS = [
  { id: "snippets", label: "Context Snippets", icon: FileText },
  { id: "documents", label: "Documents", icon: Layers },
  { id: "co-mentions", label: "Co-mentions", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Component ──────────────────────────────────────────────────────

export function EntityProfile({ entityId }: { entityId: string }) {
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("snippets");

  useEffect(() => {
    setLoading(true);
    getEntityDetails(entityId)
      .then(setEntity)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityId]);

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Card className="paper-grain border-border bg-card">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────
  if (!entity) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Entity Profile</span>
        </nav>
        <Card className="paper-grain border-border bg-card">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Entity not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/" className="hover:text-foreground transition-colors">
          Entity Profile
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-xs">
          {entity.canonical_name}
        </span>
      </nav>

      {/* Header card */}
      <Card className="paper-grain border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {entity.canonical_name}
              </h1>
              <Badge
                variant="outline"
                className="mt-1 text-xs capitalize"
              >
                {entity.entity_type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Hash className="h-4 w-4 text-gold" />}
              label="Total Mentions"
              value={entity.total_mentions.toLocaleString()}
            />
            <StatCard
              icon={<FileText className="h-4 w-4 text-gold" />}
              label="Documents"
              value={entity.unique_documents.toLocaleString()}
            />
            <StatCard
              icon={<Layers className="h-4 w-4 text-gold" />}
              label="Sections"
              value={String(entity.sections.length)}
            />
            <StatCard
              icon={<Layers className="h-4 w-4 text-gold" />}
              label="Doc Types"
              value={String(entity.doc_types.length)}
            />
          </div>

          {/* Aliases */}
          {entity.aliases.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Aliases
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entity.aliases.map((alias) => (
                  <Badge
                    key={alias}
                    variant="secondary"
                    className="text-xs"
                  >
                    {alias}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabbed content */}
      <Card className="paper-grain border-border bg-card">
        <div className="flex gap-1 border-b border-border/50 p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <CardContent className="pt-4">
          {activeTab === "snippets" && (
            <ContextSnippetsTab
              entityId={entityId}
              entityName={entity.canonical_name}
              entityAliases={entity.aliases}
              sections={entity.sections}
              docTypes={entity.doc_types}
            />
          )}
          {activeTab === "documents" && (
            <DocumentsTab entityId={entityId} />
          )}
          {activeTab === "co-mentions" && (
            <CoMentionsTab entityId={entityId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat card sub-component ─────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
