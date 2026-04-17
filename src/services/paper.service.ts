import type { PaperMetadata, PaperAuthor } from "@/types";

/**
 * Resolve a DOI or arXiv ID to paper metadata.
 * Uses Semantic Scholar API as primary, CrossRef as fallback.
 */
export async function resolvePaper(
  identifier: string
): Promise<PaperMetadata | null> {
  // Normalize identifier
  const cleanId = identifier.trim();

  // Try Semantic Scholar first
  const ssResult = await fetchSemanticScholar(cleanId);
  if (ssResult) return ssResult;

  // Fallback to CrossRef for DOIs
  if (cleanId.startsWith("10.")) {
    const crResult = await fetchCrossRef(cleanId);
    if (crResult) return crResult;
  }

  return null;
}

/**
 * Search papers by keyword using Semantic Scholar API.
 */
export async function searchPapers(
  query: string,
  limit = 10
): Promise<PaperMetadata[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
      query
    )}&limit=${limit}&fields=title,authors,abstract,journal,year,externalIds,url,citationCount`;

    const res = await fetch(url, {
      headers: { "User-Agent": "AcademicXiaohongshu/1.0" },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.data || []).map(mapSemanticScholarPaper);
  } catch {
    return [];
  }
}

// --- Semantic Scholar ---

async function fetchSemanticScholar(
  identifier: string
): Promise<PaperMetadata | null> {
  try {
    // Semantic Scholar accepts DOI, arXiv ID, or paperId
    let paperId = identifier;
    if (identifier.startsWith("10.")) {
      paperId = `DOI:${identifier}`;
    } else if (/^\d{4}\.\d{4,5}/.test(identifier)) {
      paperId = `ARXIV:${identifier}`;
    }

    const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(
      paperId
    )}?fields=title,authors,abstract,journal,year,externalIds,url,citationCount`;

    const res = await fetch(url, {
      headers: { "User-Agent": "AcademicXiaohongshu/1.0" },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!res.ok) return null;

    const data = await res.json();
    return mapSemanticScholarPaper(data);
  } catch {
    return null;
  }
}

function mapSemanticScholarPaper(data: Record<string, unknown>): PaperMetadata {
  const externalIds = (data.externalIds || {}) as Record<string, string>;
  const authors = ((data.authors || []) as Array<Record<string, unknown>>).map(
    (a): PaperAuthor => ({
      name: (a.name as string) || "Unknown",
    })
  );

  const journal = data.journal as
    | { name?: string; volume?: string }
    | null
    | undefined;

  return {
    id: (data.paperId as string) || "",
    doi: externalIds.DOI || null,
    arxivId: externalIds.ArXiv || null,
    title: (data.title as string) || "Untitled",
    authors,
    abstract: (data.abstract as string) || null,
    journal: journal?.name || null,
    year: (data.year as number) || null,
    url: (data.url as string) || null,
    citationCount: (data.citationCount as number) ?? null,
  };
}

// --- CrossRef ---

async function fetchCrossRef(doi: string): Promise<PaperMetadata | null> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "AcademicXiaohongshu/1.0 (mailto:contact@academic-xiaohongshu.com)",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const work = data.message;

    const authors = (
      (work.author || []) as Array<Record<string, string>>
    ).map(
      (a): PaperAuthor => ({
        name: [a.given, a.family].filter(Boolean).join(" ") || "Unknown",
        affiliation: undefined,
        orcid: a.ORCID || undefined,
      })
    );

    const title = Array.isArray(work.title) ? work.title[0] : work.title;
    const published = work["published-print"] || work["published-online"];
    const year = published?.["date-parts"]?.[0]?.[0] || null;

    return {
      id: doi,
      doi,
      arxivId: null,
      title: title || "Untitled",
      authors,
      abstract: work.abstract
        ? work.abstract.replace(/<[^>]+>/g, "")
        : null,
      journal:
        (Array.isArray(work["container-title"])
          ? work["container-title"][0]
          : work["container-title"]) || null,
      year,
      url: work.URL || `https://doi.org/${doi}`,
      citationCount: work["is-referenced-by-count"] ?? null,
    };
  } catch {
    return null;
  }
}
