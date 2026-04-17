import { describe, it, expect } from "vitest";
import {
  createPostSchema,
  createCommentSchema,
  updateProfileSchema,
  searchQuerySchema,
  feedQuerySchema,
  registerSchema,
  loginSchema,
} from "@/lib/validators";

// ---------------------------------------------------------------------------
// createPostSchema
// ---------------------------------------------------------------------------
describe("createPostSchema", () => {
  const validPost = {
    title: "Quantum Computing Advances",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    subjectId: "subj-1",
  };

  it("accepts valid post data", () => {
    const result = createPostSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createPostSchema.safeParse({ ...validPost, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 200 characters", () => {
    const result = createPostSchema.safeParse({
      ...validPost,
      title: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing subjectId", () => {
    const result = createPostSchema.safeParse({
      ...validPost,
      subjectId: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults status to PUBLISHED", () => {
    const result = createPostSchema.safeParse(validPost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("PUBLISHED");
    }
  });

  it("accepts optional fields (summary, coverImage, images, tagIds, DRAFT status, citations)", () => {
    const result = createPostSchema.safeParse({
      ...validPost,
      summary: "A brief summary of the post",
      coverImage: "https://example.com/cover.jpg",
      images: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
      tagIds: ["tag-1", "tag-2"],
      status: "DRAFT",
      citations: [
        { paperId: "paper-1", context: "As noted in...", order: 1 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
      expect(result.data.summary).toBe("A brief summary of the post");
      expect(result.data.images).toHaveLength(2);
      expect(result.data.citations).toHaveLength(1);
    }
  });

  it("rejects invalid status value", () => {
    const result = createPostSchema.safeParse({
      ...validPost,
      status: "ARCHIVED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 9 images", () => {
    const images = Array.from(
      { length: 10 },
      (_, i) => `https://example.com/img${i}.jpg`
    );
    const result = createPostSchema.safeParse({ ...validPost, images });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCommentSchema
// ---------------------------------------------------------------------------
describe("createCommentSchema", () => {
  it("accepts a valid comment", () => {
    const result = createCommentSchema.safeParse({ content: "Great work!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = createCommentSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects content longer than 5000 characters", () => {
    const result = createCommentSchema.safeParse({
      content: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional parentId", () => {
    const result = createCommentSchema.safeParse({
      content: "Reply here",
      parentId: "comment-42",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBe("comment-42");
    }
  });
});

// ---------------------------------------------------------------------------
// updateProfileSchema
// ---------------------------------------------------------------------------
describe("updateProfileSchema", () => {
  it("accepts a valid partial update", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "Alice",
      bio: "Researcher in NLP",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object", () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects displayName longer than 50 characters", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "a".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects bio longer than 500 characters", () => {
    const result = updateProfileSchema.safeParse({
      bio: "b".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registerSchema
// ---------------------------------------------------------------------------
describe("registerSchema", () => {
  const validRegistration = {
    email: "alice@example.com",
    username: "alice_99",
    password: "securepass",
    displayName: "Alice",
  };

  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      username: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      username: "user@name!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "securepass",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "bad",
      password: "securepass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// feedQuerySchema
// ---------------------------------------------------------------------------
describe("feedQuerySchema", () => {
  it("applies defaults (sort recent, limit 20)", () => {
    const result = feedQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe("recent");
      expect(result.data.limit).toBe(20);
    }
  });

  it("rejects invalid sort value", () => {
    const result = feedQuerySchema.safeParse({ sort: "alphabetical" });
    expect(result.success).toBe(false);
  });

  it("coerces string limit to number", () => {
    const result = feedQuerySchema.safeParse({ limit: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it("rejects limit greater than 50", () => {
    const result = feedQuerySchema.safeParse({ limit: 51 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// searchQuerySchema
// ---------------------------------------------------------------------------
describe("searchQuerySchema", () => {
  it("accepts a valid search query", () => {
    const result = searchQuerySchema.safeParse({ q: "quantum computing" });
    expect(result.success).toBe(true);
  });

  it("defaults type to posts", () => {
    const result = searchQuerySchema.safeParse({ q: "quantum" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("posts");
    }
  });

  it("rejects empty query string", () => {
    const result = searchQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("accepts users type", () => {
    const result = searchQuerySchema.safeParse({ q: "alice", type: "users" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("users");
    }
  });
});
