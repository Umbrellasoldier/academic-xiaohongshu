import { z } from "zod/v4";

// Post creation/update validation
export const createPostSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200字"),
  content: z.record(z.string(), z.unknown()), // TipTap JSON
  summary: z.string().max(500).optional(),
  coverImage: z.string().url().optional(),
  images: z.array(z.string().url()).max(9).default([]),
  subjectId: z.string().min(1, "请选择学科分类"),
  tagIds: z.array(z.string()).default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  citations: z
    .array(
      z.object({
        paperId: z.string(),
        context: z.string().optional(),
        order: z.number().default(0),
      })
    )
    .default([]),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "评论不能为空").max(5000),
  parentId: z.string().optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  institution: z.string().max(100).optional(),
  orcid: z.string().max(50).optional(),
  avatar: z.string().url().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.enum(["posts", "papers", "users"]).default("posts"),
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const feedQuerySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  sort: z.enum(["recent", "popular", "trending"]).default("recent"),
});

export const registerSchema = z.object({
  email: z.email("请输入有效的邮箱地址"),
  username: z
    .string()
    .min(3, "用户名至少3个字符")
    .max(30, "用户名最多30个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),
  password: z.string().min(8, "密码至少8个字符"),
  displayName: z.string().min(1, "请输入显示名称").max(50),
});

export const loginSchema = z.object({
  email: z.email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
