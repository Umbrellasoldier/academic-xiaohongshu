import { NextRequest, NextResponse } from "next/server";
import { resolvePaper, searchPapers } from "@/services/paper.service";

// GET /api/papers?doi=...&q=...
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const doi = searchParams.get("doi");
  const arxivId = searchParams.get("arxiv");
  const query = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 20);

  // Resolve a specific paper by DOI or arXiv ID
  if (doi || arxivId) {
    const identifier = doi || arxivId || "";
    const paper = await resolvePaper(identifier);
    if (!paper) {
      return NextResponse.json(
        { error: "论文未找到" },
        { status: 404 }
      );
    }
    return NextResponse.json({ paper });
  }

  // Search papers by keyword
  if (query) {
    const papers = await searchPapers(query, limit);
    return NextResponse.json({ papers, total: papers.length, query });
  }

  return NextResponse.json(
    { error: "请提供 doi、arxiv 或 q 参数" },
    { status: 400 }
  );
}
