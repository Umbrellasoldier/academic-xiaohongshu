"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PaperMetadata } from "@/types";

interface CitationPickerProps {
  onInsert: (paper: PaperMetadata) => void;
  onClose: () => void;
}

export function CitationPicker({ onInsert, onClose }: CitationPickerProps) {
  const [query, setQuery] = useState("");
  const [doiInput, setDoiInput] = useState("");
  const [results, setResults] = useState<PaperMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [mode, setMode] = useState<"search" | "doi">("search");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || mode !== "search") return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/papers?q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await res.json();
        setResults(data.papers || []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, mode]);

  const handleDOIResolve = useCallback(async () => {
    if (!doiInput.trim()) return;
    setIsResolving(true);
    try {
      const res = await fetch(
        `/api/papers?doi=${encodeURIComponent(doiInput.trim())}`
      );
      const data = await res.json();
      if (data.paper) {
        onInsert(data.paper);
      }
    } catch {
      toast.error("论文查询失败，请检查 DOI 格式");
    } finally {
      setIsResolving(false);
    }
  }, [doiInput, onInsert]);

  return (
    <div className="rounded-lg border bg-card shadow-lg w-[420px] max-h-[400px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setMode("search")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              mode === "search"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            搜索论文
          </button>
          <button
            onClick={() => setMode("doi")}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              mode === "doi"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            DOI 查找
          </button>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search mode */}
      {mode === "search" && (
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索论文标题或关键词..."
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Results */}
          <div className="mt-2 max-h-[260px] overflow-y-auto space-y-1.5">
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              results.map((paper) => (
                <PaperResult
                  key={paper.id}
                  paper={paper}
                  onInsert={onInsert}
                />
              ))
            ) : query.trim() ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                没有找到相关论文
              </p>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                输入关键词搜索 Semantic Scholar
              </p>
            )}
          </div>
        </div>
      )}

      {/* DOI mode */}
      {mode === "doi" && (
        <div className="p-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              DOI 或 arXiv ID
            </label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                type="text"
                value={doiInput}
                onChange={(e) => setDoiInput(e.target.value)}
                placeholder="10.1038/s41586-024-... 或 2401.12345"
                className="h-8 text-sm font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDOIResolve();
                }}
              />
              <Button
                size="sm"
                onClick={handleDOIResolve}
                disabled={!doiInput.trim() || isResolving}
                className="h-8 px-3"
              >
                {isResolving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "解析"
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            输入 DOI（如 10.1038/...）或 arXiv ID（如 2401.12345）后点击解析
          </p>
        </div>
      )}
    </div>
  );
}

function PaperResult({
  paper,
  onInsert,
}: {
  paper: PaperMetadata;
  onInsert: (paper: PaperMetadata) => void;
}) {
  const authorStr =
    paper.authors.length > 2
      ? `${paper.authors[0].name} et al.`
      : paper.authors.map((a) => a.name).join(", ");

  return (
    <div className="flex items-start gap-2 rounded-md border p-2 transition-colors hover:bg-muted/50">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-medium leading-snug line-clamp-2">
          {paper.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {authorStr}
          {paper.year ? ` (${paper.year})` : ""}
          {paper.journal ? ` · ${paper.journal}` : ""}
        </p>
      </div>
      <button
        onClick={() => onInsert(paper)}
        className="mt-0.5 shrink-0 rounded p-1 text-primary hover:bg-primary/10"
        title="插入引用"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
