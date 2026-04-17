"use client";

import { ExternalLink, Users, BookOpen, Hash } from "lucide-react";
import type { PaperMetadata } from "@/types";
import Link from "next/link";

interface CitationCardProps {
  paper: PaperMetadata;
  /** Compact mode for inline references */
  compact?: boolean;
  /** Show order number */
  order?: number;
}

export function CitationCard({ paper, compact = false, order }: CitationCardProps) {
  const authorStr = paper.authors.length > 0
    ? paper.authors.length <= 3
      ? paper.authors.map((a) => a.name).join(", ")
      : `${paper.authors[0].name} et al.`
    : "Unknown";

  const shortCite = `${paper.authors[0]?.name?.split(" ").pop() || "Unknown"}${
    paper.authors.length > 1 ? " et al." : ""
  }${paper.year ? `, ${paper.year}` : ""}`;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        [{order != null ? order : shortCite}]
      </span>
    );
  }

  const doiLink = paper.doi ? `https://doi.org/${paper.doi}` : paper.url;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2 transition-colors hover:bg-muted/30">
      {/* Title */}
      <div className="flex items-start gap-2">
        {order != null && (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
            {order}
          </span>
        )}
        <h4 className="text-sm font-semibold leading-snug line-clamp-2">
          {paper.title}
        </h4>
      </div>

      {/* Authors */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3 w-3 shrink-0" />
        <span className="line-clamp-1">{authorStr}</span>
      </div>

      {/* Journal + Year */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {paper.journal && (
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {paper.journal}
          </span>
        )}
        {paper.year && <span>{paper.year}</span>}
        {paper.citationCount != null && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            被引 {paper.citationCount}
          </span>
        )}
      </div>

      {/* Abstract preview */}
      {paper.abstract && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {paper.abstract}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {doiLink && (
          <a
            href={doiLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            查看原文
          </a>
        )}
        {paper.doi && (
          <span className="text-xs text-muted-foreground font-mono">
            DOI: {paper.doi}
          </span>
        )}
        {paper.arxivId && (
          <a
            href={`https://arxiv.org/abs/${paper.arxivId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            arXiv:{paper.arxivId}
          </a>
        )}
      </div>
    </div>
  );
}
