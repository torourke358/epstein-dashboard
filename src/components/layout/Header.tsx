"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "./ThemeProvider";
import { searchEntities, searchDocuments } from "@/lib/queries";
import type { EntitySearchResult, Document } from "@/lib/types";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/documents": "Document Explorer",
  "/compare": "Entity Comparison",
};

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  let title = ROUTE_TITLES[pathname] || "Dashboard";
  if (pathname.startsWith("/entity/")) {
    title = "Entity Profile";
  }

  // Global search state
  const [searchTerm, setSearchTerm] = useState("");
  const [entityResults, setEntityResults] = useState<EntitySearchResult[]>([]);
  const [docResults, setDocResults] = useState<Document[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchTerm.trim()) {
      setEntityResults([]);
      setDocResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const [entities, docs] = await Promise.all([
          searchEntities(searchTerm, 5),
          searchDocuments(searchTerm, 5),
        ]);
        setEntityResults(entities);
        setDocResults(docs);
        setShowResults(true);
      } catch {
        setEntityResults([]);
        setDocResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // "/" keyboard shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowResults(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside closes dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToEntity = useCallback(
    (id: string) => {
      setShowResults(false);
      setSearchTerm("");
      router.push(`/entity/${id}`);
    },
    [router]
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/50 px-4 md:px-6">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Route title */}
      <h2 className="font-heading text-lg font-bold text-foreground shrink-0">
        {title}
      </h2>

      {/* Global search */}
      <div ref={searchRef} className="relative flex-1 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Search entities & documents... (press "/")'
            className="w-full rounded-md border border-border bg-muted/30 py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>

        {showResults &&
          (entityResults.length > 0 || docResults.length > 0) && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-80 overflow-y-auto">
              {entityResults.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Entities
                  </p>
                  {entityResults.map((entity) => (
                    <button
                      key={entity.id}
                      onClick={() => navigateToEntity(entity.id)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium text-foreground truncate">
                        {entity.canonical_name}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize shrink-0"
                      >
                        {entity.entity_type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              {docResults.length > 0 && (
                <div
                  className={entityResults.length > 0 ? "border-t border-border" : ""}
                >
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Documents
                  </p>
                  {docResults.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        setShowResults(false);
                        setSearchTerm("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium text-foreground truncate">
                        {doc.filename}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                      >
                        {doc.section.replace("/epstein/", "")}
                      </Badge>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* Right area */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          <span>Source: DOJ Epstein Library</span>
        </div>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
