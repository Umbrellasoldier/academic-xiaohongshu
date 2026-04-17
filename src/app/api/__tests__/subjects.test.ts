import "@/test/mocks/prisma";
import "@/test/mocks/auth";

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";
import { clearMockSession } from "@/test/mocks/auth";
import { GET } from "@/app/api/subjects/route";

// ─── GET /api/subjects ───────────────────────────────────────────────

describe("GET /api/subjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns subject tree hierarchy with children", async () => {
    prismaMock.subject.findMany.mockResolvedValue([
      {
        id: "s1",
        name: "Computer Science",
        nameZh: "计算机科学",
        slug: "cs",
        color: "#3B82F6",
        icon: "💻",
        parentId: null,
      },
      {
        id: "s2",
        name: "Mathematics",
        nameZh: "数学",
        slug: "math",
        color: "#EF4444",
        icon: "📐",
        parentId: null,
      },
      {
        id: "s1-1",
        name: "Artificial Intelligence",
        nameZh: "人工智能",
        slug: "ai",
        color: "#3B82F6",
        icon: "🤖",
        parentId: "s1",
      },
      {
        id: "s1-2",
        name: "Databases",
        nameZh: "数据库",
        slug: "databases",
        color: "#3B82F6",
        icon: "💾",
        parentId: "s1",
      },
      {
        id: "s2-1",
        name: "Algebra",
        nameZh: "代数",
        slug: "algebra",
        color: "#EF4444",
        icon: "🔢",
        parentId: "s2",
      },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subjects).toHaveLength(2); // 2 level-1 subjects

    // Computer Science
    const cs = data.subjects.find((s: { slug: string }) => s.slug === "cs");
    expect(cs).toBeDefined();
    expect(cs.name).toBe("Computer Science");
    expect(cs.children).toHaveLength(2);
    expect(cs.children[0]).toMatchObject({
      id: "s1-1",
      name: "Artificial Intelligence",
      slug: "ai",
    });
    expect(cs.children[1]).toMatchObject({
      id: "s1-2",
      slug: "databases",
    });

    // Mathematics
    const math = data.subjects.find((s: { slug: string }) => s.slug === "math");
    expect(math).toBeDefined();
    expect(math.children).toHaveLength(1);
    expect(math.children[0].slug).toBe("algebra");
  });

  it("returns empty children array for subjects with no children", async () => {
    prismaMock.subject.findMany.mockResolvedValue([
      {
        id: "s1",
        name: "Physics",
        nameZh: "物理学",
        slug: "physics",
        color: "#10B981",
        icon: "⚛️",
        parentId: null,
      },
    ]);

    const res = await GET();
    const data = await res.json();

    expect(data.subjects).toHaveLength(1);
    expect(data.subjects[0].children).toEqual([]);
  });

  it("returns empty array when no subjects exist", async () => {
    prismaMock.subject.findMany.mockResolvedValue([]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subjects).toEqual([]);
  });

  it("does not include parentId in response children", async () => {
    prismaMock.subject.findMany.mockResolvedValue([
      { id: "s1", name: "CS", nameZh: "计算机", slug: "cs", color: "#000", icon: "💻", parentId: null },
      { id: "s1-1", name: "AI", nameZh: "人工智能", slug: "ai", color: "#000", icon: "🤖", parentId: "s1" },
    ]);

    const res = await GET();
    const data = await res.json();

    const child = data.subjects[0].children[0];
    expect(child).not.toHaveProperty("parentId");
    expect(child).toMatchObject({
      id: "s1-1",
      name: "AI",
      nameZh: "人工智能",
      slug: "ai",
      color: "#000",
      icon: "🤖",
    });
  });

  it("sets Cache-Control header", async () => {
    prismaMock.subject.findMany.mockResolvedValue([]);

    const res = await GET();

    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });

  it("orders subjects by sortOrder", async () => {
    prismaMock.subject.findMany.mockResolvedValue([]);

    await GET();

    expect(prismaMock.subject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sortOrder: "asc" },
      })
    );
  });

  it("returns 500 on database error", async () => {
    prismaMock.subject.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("获取学科列表失败");
  });
});
