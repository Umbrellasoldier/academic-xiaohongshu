import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock paper service
vi.mock("@/services/paper.service", () => ({
  resolvePaper: vi.fn(),
  searchPapers: vi.fn(),
}));

import { resolvePaper, searchPapers } from "@/services/paper.service";
import { GET } from "@/app/api/papers/route";

const mockResolve = resolvePaper as ReturnType<typeof vi.fn>;
const mockSearch = searchPapers as ReturnType<typeof vi.fn>;

function getReq(url: string) {
  return new NextRequest(url);
}

describe("GET /api/papers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves paper by DOI", async () => {
    const paper = { title: "Test Paper", doi: "10.1234/test" };
    mockResolve.mockResolvedValue(paper);

    const res = await GET(getReq("http://localhost/api/papers?doi=10.1234/test") as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paper.title).toBe("Test Paper");
    expect(mockResolve).toHaveBeenCalledWith("10.1234/test");
  });

  it("resolves paper by arXiv ID", async () => {
    const paper = { title: "arXiv Paper", arxivId: "2301.12345" };
    mockResolve.mockResolvedValue(paper);

    const res = await GET(getReq("http://localhost/api/papers?arxiv=2301.12345") as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paper.title).toBe("arXiv Paper");
  });

  it("returns 404 when paper not found", async () => {
    mockResolve.mockResolvedValue(null);

    const res = await GET(getReq("http://localhost/api/papers?doi=10.0000/nonexistent") as any);
    expect(res.status).toBe(404);
  });

  it("searches papers by keyword", async () => {
    const papers = [
      { title: "Machine Learning Paper" },
      { title: "Deep Learning Paper" },
    ];
    mockSearch.mockResolvedValue(papers);

    const res = await GET(getReq("http://localhost/api/papers?q=machine+learning") as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.papers).toHaveLength(2);
    expect(data.query).toBe("machine learning");
    expect(mockSearch).toHaveBeenCalledWith("machine learning", 10);
  });

  it("respects limit parameter", async () => {
    mockSearch.mockResolvedValue([]);

    await GET(getReq("http://localhost/api/papers?q=test&limit=5") as any);
    expect(mockSearch).toHaveBeenCalledWith("test", 5);
  });

  it("caps limit at 20", async () => {
    mockSearch.mockResolvedValue([]);

    await GET(getReq("http://localhost/api/papers?q=test&limit=100") as any);
    expect(mockSearch).toHaveBeenCalledWith("test", 20);
  });

  it("returns 400 when no parameters provided", async () => {
    const res = await GET(getReq("http://localhost/api/papers") as any);
    expect(res.status).toBe(400);
  });
});
