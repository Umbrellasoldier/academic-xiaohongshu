import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import OpenAI from "openai";

// --- Prisma ---
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- Ollama (OpenAI-compatible) ---
const ai = new OpenAI({
  apiKey: "ollama", // Ollama 不需要真实 API Key，但 SDK 要求非空
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
});

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-it-bf16";

const POST_TITLE_PREFIX = "【文献推荐】";

// --- Types ---
interface PaperRec {
  title: string;
  titleZh: string;
  authors: string;
  venue: string;
  year: number;
  doi: string | null;
  subjectSlug: string;
  abstract: string;
  significance: string;
  tags: string[];
}

// --- Helpers ---

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Build TipTap JSON document for a paper recommendation post */
function buildPostContent(paper: PaperRec): object {
  const nodes: object[] = [];

  // English title
  nodes.push({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text: paper.title }],
  });

  // Chinese title
  nodes.push({
    type: "paragraph",
    content: [
      { type: "text", marks: [{ type: "bold" }], text: "中文标题：" },
      { type: "text", text: paper.titleZh },
    ],
  });

  // Authors
  nodes.push({
    type: "paragraph",
    content: [
      { type: "text", marks: [{ type: "bold" }], text: "作者：" },
      { type: "text", text: paper.authors },
    ],
  });

  // Venue + Year
  nodes.push({
    type: "paragraph",
    content: [
      { type: "text", marks: [{ type: "bold" }], text: "发表：" },
      { type: "text", text: `${paper.venue}, ${paper.year}` },
    ],
  });

  // DOI (if available)
  if (paper.doi) {
    nodes.push({
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "DOI：" },
        {
          type: "text",
          marks: [
            {
              type: "link",
              attrs: {
                href: `https://doi.org/${paper.doi}`,
                target: "_blank",
              },
            },
          ],
          text: paper.doi,
        },
      ],
    });
  }

  // Divider
  nodes.push({ type: "horizontalRule" });

  // Abstract
  nodes.push({
    type: "heading",
    attrs: { level: 3 },
    content: [{ type: "text", text: "摘要" }],
  });
  nodes.push({
    type: "paragraph",
    content: [{ type: "text", text: paper.abstract }],
  });

  // Significance
  nodes.push({
    type: "heading",
    attrs: { level: 3 },
    content: [{ type: "text", text: "推荐理由" }],
  });
  nodes.push({
    type: "paragraph",
    content: [{ type: "text", text: paper.significance }],
  });

  return { type: "doc", content: nodes };
}

/** Extract JSON array from AI response text, handling various formats */
function extractJsonArray(text: string): PaperRec[] {
  // 1. Strip <think>...</think> tags
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // 2. Try to find a JSON array via regex (handles extra text around it)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    cleaned = arrayMatch[0];
  }

  // 3. Strip markdown code fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 4. If wrapped in {"papers": [...]}, extract the array
  if (cleaned.startsWith("{")) {
    try {
      const obj = JSON.parse(cleaned);
      if (obj.papers && Array.isArray(obj.papers)) return obj.papers;
      if (obj.recommendations && Array.isArray(obj.recommendations))
        return obj.recommendations;
      // Try first array-valued key
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) return obj[key];
      }
    } catch {
      // fall through
    }
  }

  const papers = JSON.parse(cleaned);
  if (!Array.isArray(papers)) throw new Error("Parsed result is not an array");
  return papers;
}

/** Call Ollama (Gemma 4) to get 10 paper recommendations for a subject */
async function fetchRecommendations(
  subjectNameZh: string,
  childSubjects: { slug: string; nameZh: string }[]
): Promise<PaperRec[]> {
  const childList = childSubjects
    .map((s) => `${s.slug} - ${s.nameZh}`)
    .join("\n");

  const prompt = `你是一名资深学术顾问。请推荐「${subjectNameZh}」领域近年来最具影响力的 10 篇学术论文（优先推荐 2023-2025 年的高引论文）。

该学科的二级学科列表：
${childList}

请直接返回一个 JSON 格式，结构为 {"papers": [...]}，其中数组每个元素包含：
{
  "title": "论文英文原标题",
  "titleZh": "论文中文翻译标题",
  "authors": "作者列表（如 Author1, Author2 et al.）",
  "venue": "发表期刊/会议/预印本平台",
  "year": 2024,
  "doi": "论文的DOI（如 10.xxxx/xxxxx）。arXiv论文请用 10.48550/arXiv.xxxx.xxxxx 格式。请尽力提供准确DOI，仅在完全不知道时设为 null",
  "subjectSlug": "从上面的二级学科列表中选择最匹配的 slug",
  "abstract": "200字以内的中文摘要，介绍论文主要内容和方法",
  "significance": "该论文的重要性和创新点（100字以内中文）",
  "tags": ["关键词1", "关键词2"]
}

严格要求：
- 优先推荐 2023-2025 年的论文，也可包含少量经典高引论文
- 优先选择发表在顶级期刊/会议的高影响力工作
- 尽量覆盖不同的二级学科方向
- subjectSlug 必须是上面列表中存在的 slug 值
- DOI 请尽力提供准确值，arXiv 论文使用 10.48550/arXiv.xxxx.xxxxx 格式，仅在完全无法确定时设为 null
- tags 为 1-3 个中文关键词
- 只返回 JSON，不要添加任何解释文字`;

  const response = await ai.chat.completions.create({
    model: OLLAMA_MODEL,
    temperature: 0.3,
    max_tokens: 8000,
    messages: [
      {
        role: "system",
        content:
          "你是一名学术顾问。用户会请求文献推荐，你必须严格返回 JSON 格式的结果。不要添加任何额外的解释文字。",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content || "[]";

  try {
    return extractJsonArray(text);
  } catch (e) {
    console.error(`    ❌ JSON parse failed: ${(e as Error).message}`);
    console.error(`    Raw (first 500 chars): ${text.slice(0, 500)}`);
    return [];
  }
}

// --- Main ---

async function main() {
  console.log("📚 Generating literature recommendation posts...\n");

  // Get all level-1 subjects
  const level1Subjects = await prisma.subject.findMany({
    where: { parentId: null },
    select: { id: true, slug: true, nameZh: true },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`Found ${level1Subjects.length} level-1 subjects\n`);

  let totalPosts = 0;
  let skippedSubjects = 0;
  let failedSubjects = 0;

  for (let i = 0; i < level1Subjects.length; i++) {
    const subject = level1Subjects[i];
    const progress = `[${i + 1}/${level1Subjects.length}]`;

    // 1. Find the subject account
    const user = await prisma.user.findUnique({
      where: { email: `subject-${subject.slug}@academic.local` },
      select: { id: true },
    });

    if (!user) {
      console.log(
        `${progress} ⚠ No account for ${subject.nameZh} (subject-${subject.slug}), skipping`
      );
      skippedSubjects++;
      continue;
    }

    // 2. Check if already has recommendation posts (idempotent)
    const existing = await prisma.post.count({
      where: {
        authorId: user.id,
        title: { startsWith: POST_TITLE_PREFIX },
      },
    });

    if (existing >= 10) {
      console.log(
        `${progress} ⏭ ${subject.nameZh} already has ${existing} posts, skipping`
      );
      skippedSubjects++;
      continue;
    }

    // 3. Get child subjects
    const children = await prisma.subject.findMany({
      where: { parentId: subject.id },
      select: { id: true, slug: true, nameZh: true },
      orderBy: { sortOrder: "asc" },
    });

    if (children.length === 0) {
      console.log(
        `${progress} ⚠ ${subject.nameZh} has no child subjects, skipping`
      );
      skippedSubjects++;
      continue;
    }

    // 4. Call AI with retry
    console.log(`${progress} 🤖 Generating for ${subject.nameZh}...`);

    let papers: PaperRec[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        papers = await fetchRecommendations(subject.nameZh, children);
        if (papers.length > 0) break;
        if (attempt === 1) {
          console.log(`    ⚠ Empty result, retrying...`);
          await sleep(3000);
        }
      } catch (err) {
        console.error(
          `    ❌ Attempt ${attempt} failed: ${(err as Error).message}`
        );
        if (attempt === 1) await sleep(5000);
      }
    }

    if (papers.length === 0) {
      console.log(`    ⚠ No papers after retries, skipping`);
      failedSubjects++;
      await sleep(5000);
      continue;
    }

    // Build a slug→id map for child subjects
    const childMap: Record<string, string> = {};
    for (const c of children) {
      childMap[c.slug] = c.id;
    }

    // 5. Create posts
    let created = 0;
    for (const paper of papers) {
      try {
        // Resolve subject — use child if valid, fall back to first child
        let subjectId = childMap[paper.subjectSlug];
        if (!subjectId) {
          subjectId = children[0].id;
        }

        const title = `${POST_TITLE_PREFIX}${paper.titleZh || paper.title}`;

        // Skip if this exact title already exists for this author
        const dup = await prisma.post.findFirst({
          where: { authorId: user.id, title },
          select: { id: true },
        });
        if (dup) continue;

        const content = buildPostContent(paper);
        const summary = (paper.abstract || "").slice(0, 200);

        // Create tags via connectOrCreate
        const tagData = (paper.tags || [])
          .slice(0, 3)
          .filter((t: unknown) => typeof t === "string" && t.length > 0)
          .map((tag: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tag },
                create: { name: tag },
              },
            },
          }));

        await prisma.post.create({
          data: {
            title,
            content,
            summary,
            status: "PUBLISHED",
            authorId: user.id,
            subjectId,
            tags: tagData.length > 0 ? { create: tagData } : undefined,
          },
        });

        created++;
      } catch (postErr) {
        console.error(
          `    ⚠ Failed to create post "${paper.titleZh}": ${(postErr as Error).message}`
        );
      }
    }

    totalPosts += created;
    console.log(
      `    ✅ Created ${created} posts (${papers.length} papers returned)`
    );

    // 6. Rate limit — wait between subjects
    if (i < level1Subjects.length - 1) {
      await sleep(5000);
    }
  }

  console.log(`\n🎉 Done!`);
  console.log(`  📝 Total posts created: ${totalPosts}`);
  console.log(`  ⏭ Skipped subjects: ${skippedSubjects}`);
  console.log(`  ❌ Failed subjects: ${failedSubjects}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
