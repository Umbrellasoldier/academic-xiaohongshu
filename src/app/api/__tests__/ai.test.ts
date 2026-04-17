import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock AI service
vi.mock("@/services/ai.service", () => ({
  summarizePost: vi.fn(),
  translateAcademic: vi.fn(),
  getRecommendations: vi.fn(),
}));

import { summarizePost, translateAcademic, getRecommendations } from "@/services/ai.service";
import { POST as summarizeHandler } from "@/app/api/ai/summarize/route";
import { POST as translateHandler } from "@/app/api/ai/translate/route";
import { POST as recommendHandler } from "@/app/api/ai/recommend/route";

const mockSummarize = summarizePost as ReturnType<typeof vi.fn>;
const mockTranslate = translateAcademic as ReturnType<typeof vi.fn>;
const mockRecommend = getRecommendations as ReturnType<typeof vi.fn>;

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns streaming response on valid input", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Summary here"));
        controller.close();
      },
    });
    mockSummarize.mockResolvedValue(mockStream);

    const req = jsonReq("http://localhost/api/ai/summarize", {
      title: "Test Title",
      content: "Test content text",
    });
    const res = await summarizeHandler(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");

    const text = await res.text();
    expect(text).toBe("Summary here");
  });

  it("handles TipTap JSON content", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ok"));
        controller.close();
      },
    });
    mockSummarize.mockResolvedValue(mockStream);

    const req = jsonReq("http://localhost/api/ai/summarize", {
      title: "Test",
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
        ],
      },
    });
    const res = await summarizeHandler(req as any);
    expect(res.status).toBe(200);
    // Verify extractText extracted the text
    expect(mockSummarize).toHaveBeenCalledWith("Test", expect.stringContaining("Hello world"));
  });

  it("returns 400 when title is missing", async () => {
    const req = jsonReq("http://localhost/api/ai/summarize", {
      content: "text",
    });
    const res = await summarizeHandler(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    const req = jsonReq("http://localhost/api/ai/summarize", {
      title: "Test",
    });
    const res = await summarizeHandler(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 500 when AI service throws", async () => {
    mockSummarize.mockRejectedValue(new Error("API key invalid"));

    const req = jsonReq("http://localhost/api/ai/summarize", {
      title: "Test",
      content: "text",
    });
    const res = await summarizeHandler(req as any);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("API key invalid");
  });
});

describe("POST /api/ai/translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns streaming response on valid input", async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("翻译结果"));
        controller.close();
      },
    });
    mockTranslate.mockResolvedValue(mockStream);

    const req = jsonReq("http://localhost/api/ai/translate", {
      text: "Hello world",
    });
    const res = await translateHandler(req as any);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toBe("翻译结果");
  });

  it("uses default source and target language", async () => {
    const mockStream = new ReadableStream({
      start(controller) { controller.close(); },
    });
    mockTranslate.mockResolvedValue(mockStream);

    const req = jsonReq("http://localhost/api/ai/translate", {
      text: "test",
    });
    await translateHandler(req as any);
    expect(mockTranslate).toHaveBeenCalledWith("test", "英文", "中文");
  });

  it("accepts custom languages", async () => {
    const mockStream = new ReadableStream({
      start(controller) { controller.close(); },
    });
    mockTranslate.mockResolvedValue(mockStream);

    const req = jsonReq("http://localhost/api/ai/translate", {
      text: "test",
      sourceLang: "中文",
      targetLang: "英文",
    });
    await translateHandler(req as any);
    expect(mockTranslate).toHaveBeenCalledWith("test", "中文", "英文");
  });

  it("returns 400 when text is missing", async () => {
    const req = jsonReq("http://localhost/api/ai/translate", {});
    const res = await translateHandler(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when text exceeds 10000 chars", async () => {
    const req = jsonReq("http://localhost/api/ai/translate", {
      text: "a".repeat(10001),
    });
    const res = await translateHandler(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("10000");
  });

  it("returns 500 when service throws", async () => {
    mockTranslate.mockRejectedValue(new Error("Service down"));

    const req = jsonReq("http://localhost/api/ai/translate", {
      text: "test",
    });
    const res = await translateHandler(req as any);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/ai/recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recommended keywords", async () => {
    mockRecommend.mockResolvedValue(["machine learning", "NLP", "transformers"]);

    const req = jsonReq("http://localhost/api/ai/recommend", {
      interests: ["AI"],
      recentPosts: ["deep learning paper"],
    });
    const res = await recommendHandler(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.keywords).toEqual(["machine learning", "NLP", "transformers"]);
  });

  it("works with empty interests and recentPosts", async () => {
    mockRecommend.mockResolvedValue(["science"]);

    const req = jsonReq("http://localhost/api/ai/recommend", {});
    const res = await recommendHandler(req as any);
    expect(res.status).toBe(200);
    expect(mockRecommend).toHaveBeenCalledWith([], []);
  });

  it("returns 500 when service throws", async () => {
    mockRecommend.mockRejectedValue(new Error("Quota exceeded"));

    const req = jsonReq("http://localhost/api/ai/recommend", {
      interests: ["AI"],
    });
    const res = await recommendHandler(req as any);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Quota exceeded");
  });
});
