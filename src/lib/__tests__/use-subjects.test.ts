import { describe, it, expect } from "vitest";
import {
  flattenSubjects,
  findSubjectBySlug,
  findParentSubject,
} from "@/lib/hooks/use-subjects";
import type { SubjectData } from "@/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const mockSubjects: SubjectData[] = [
  {
    id: "1",
    name: "Computer Science",
    nameZh: "计算机科学",
    slug: "computer-science",
    color: "#3B82F6",
    icon: null,
    children: [
      {
        id: "1a",
        name: "Artificial Intelligence",
        nameZh: "人工智能",
        slug: "artificial-intelligence",
        color: "#6366F1",
        icon: null,
      },
      {
        id: "1b",
        name: "Computer Vision",
        nameZh: "计算机视觉",
        slug: "computer-vision",
        color: "#8B5CF6",
        icon: null,
      },
    ],
  },
  {
    id: "2",
    name: "Mathematics",
    nameZh: "数学",
    slug: "mathematics",
    color: "#F59E0B",
    icon: null,
    children: [
      {
        id: "2a",
        name: "Algebra",
        nameZh: "代数学",
        slug: "algebra",
        color: "#F97316",
        icon: null,
      },
    ],
  },
  {
    id: "3",
    name: "Physics",
    nameZh: "物理学",
    slug: "physics",
    color: "#10B981",
    icon: null,
  },
];

// ---------------------------------------------------------------------------
// flattenSubjects
// ---------------------------------------------------------------------------
describe("flattenSubjects", () => {
  it("flattens the tree to 6 items", () => {
    const result = flattenSubjects(mockSubjects);
    expect(result).toHaveLength(6);
  });

  it("includes parent slugs", () => {
    const slugs = flattenSubjects(mockSubjects).map((s) => s.slug);
    expect(slugs).toContain("computer-science");
    expect(slugs).toContain("mathematics");
    expect(slugs).toContain("physics");
  });

  it("includes children slugs", () => {
    const slugs = flattenSubjects(mockSubjects).map((s) => s.slug);
    expect(slugs).toContain("artificial-intelligence");
    expect(slugs).toContain("computer-vision");
    expect(slugs).toContain("algebra");
  });

  it("handles a subject with no children", () => {
    const physics = mockSubjects.filter((s) => s.slug === "physics");
    const result = flattenSubjects(physics);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("physics");
  });

  it("handles an empty array", () => {
    const result = flattenSubjects([]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// findSubjectBySlug
// ---------------------------------------------------------------------------
describe("findSubjectBySlug", () => {
  it("finds a level-1 subject", () => {
    const result = findSubjectBySlug(mockSubjects, "computer-science");
    expect(result).toBeDefined();
    expect(result!.id).toBe("1");
  });

  it("finds a level-2 subject", () => {
    const result = findSubjectBySlug(mockSubjects, "algebra");
    expect(result).toBeDefined();
    expect(result!.id).toBe("2a");
  });

  it("returns undefined for a nonexistent slug", () => {
    const result = findSubjectBySlug(mockSubjects, "biology");
    expect(result).toBeUndefined();
  });

  it("handles an empty array", () => {
    const result = findSubjectBySlug([], "computer-science");
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findParentSubject
// ---------------------------------------------------------------------------
describe("findParentSubject", () => {
  it("returns itself for a level-1 subject", () => {
    const result = findParentSubject(mockSubjects, "mathematics");
    expect(result).toBeDefined();
    expect(result!.id).toBe("2");
    expect(result!.slug).toBe("mathematics");
  });

  it("finds the parent of a level-2 subject", () => {
    const result = findParentSubject(mockSubjects, "computer-vision");
    expect(result).toBeDefined();
    expect(result!.id).toBe("1");
    expect(result!.slug).toBe("computer-science");
  });

  it("returns undefined for a nonexistent slug", () => {
    const result = findParentSubject(mockSubjects, "biology");
    expect(result).toBeUndefined();
  });

  it("handles a subject without children", () => {
    const result = findParentSubject(mockSubjects, "physics");
    expect(result).toBeDefined();
    expect(result!.id).toBe("3");
  });
});
