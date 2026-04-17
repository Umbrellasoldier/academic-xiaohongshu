import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import OpenAI from "openai";

// --- Config ---
const LIMIT = parseInt(process.env.ENRICH_LIMIT || "9999", 10);
const DELAY_MS = 1000; // 1s between API calls
const POST_TITLE_PREFIX = "【文献推荐】";

// --- Prisma ---
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- AI (OpenAI-compatible) ---
const ai = new OpenAI({
  apiKey: process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || "",
  baseURL: process.env.AI_BASE_URL || "https://relay.nf.video/v1",
  timeout: 5 * 60 * 1000, // 5 minutes
});
const MODEL = process.env.AI_MODEL || "gpt-5.4";

// --- TipTap types ---

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

// --- TipTap node builders ---

function textNode(text: string, marks?: TipTapNode["marks"]): TipTapNode {
  const node: TipTapNode = { type: "text", text };
  if (marks) node.marks = marks;
  return node;
}

function paragraph(...content: TipTapNode[]): TipTapNode {
  return { type: "paragraph", content };
}

function heading(level: number, text: string): TipTapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [textNode(text)],
  };
}

function horizontalRule(): TipTapNode {
  return { type: "horizontalRule" };
}

function bulletList(items: string[]): TipTapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(textNode(item))],
    })),
  };
}

// --- Text extraction ---

function extractTextFromNodes(nodes: TipTapNode[]): string {
  let result = "";
  for (const node of nodes) {
    if (node.text) result += node.text;
    if (node.content) result += extractTextFromNodes(node.content);
  }
  return result;
}

// --- Enrichment detection ---

const ENRICHMENT_HEADINGS = new Set([
  "研究背景与动机",
  "核心方法与技术路线",
  "主要实验结果与发现",
  "学术影响与后续发展",
  "延伸阅读",
]);

function isEnriched(content: { type: string; content: TipTapNode[] }): boolean {
  return (content.content || []).some(
    (node) =>
      node.type === "heading" &&
      ENRICHMENT_HEADINGS.has(extractTextFromNodes(node.content || []))
  );
}

// --- Paper info extraction ---

function extractPaperInfo(content: { type: string; content: TipTapNode[] }) {
  const nodes = content.content || [];
  let title = "";
  let titleZh = "";
  let authors = "";
  let venue = "";
  let abstract = "";
  let significance = "";

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type === "heading" && node.attrs?.level === 2) {
      title = extractTextFromNodes(node.content || []);
    }

    if (node.type === "paragraph" && node.content) {
      const fullText = extractTextFromNodes(node.content);
      if (fullText.startsWith("中文标题：")) {
        titleZh = fullText.replace("中文标题：", "");
      } else if (fullText.startsWith("作者：")) {
        authors = fullText.replace("作者：", "");
      } else if (fullText.startsWith("发表：")) {
        venue = fullText.replace("发表：", "");
      }
    }

    if (node.type === "heading" && node.attrs?.level === 3) {
      const headingText = extractTextFromNodes(node.content || []);
      const nextNode = nodes[i + 1];
      if (nextNode?.type === "paragraph") {
        const bodyText = extractTextFromNodes(nextNode.content || []);
        if (headingText === "摘要") {
          abstract = bodyText;
        } else if (headingText === "推荐理由") {
          significance = bodyText;
        }
      }
    }
  }

  return { title, titleZh, authors, venue, abstract, significance };
}

// --- JSON extraction ---

function extractJson(text: string): Record<string, unknown> {
  // Strip <think>...</think> tags
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Strip markdown code fences
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try to find a JSON object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    cleaned = objMatch[0];
  }

  // Fix trailing commas in arrays/objects (e.g., ["item",] or {"key": "val",})
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  // Fix bad escape characters (e.g., LaTeX \alpha, \mathcal) — double-escape them
  cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

  return JSON.parse(cleaned);
}

// --- AI enrichment ---

interface EnrichedContent {
  background: string;
  methods: string;
  results: string[];
  impact: string;
  relatedPapers: string[];
}

async function generateEnrichedContent(
  paperInfo: ReturnType<typeof extractPaperInfo>
): Promise<EnrichedContent> {
  const prompt = `你是一名资深学术专家。请基于以下论文信息，生成详细的扩展内容。

论文信息：
- 英文标题：${paperInfo.title}
- 中文标题：${paperInfo.titleZh}
- 作者：${paperInfo.authors}
- 发表信息：${paperInfo.venue}
- 现有摘要：${paperInfo.abstract}
- 现有推荐理由：${paperInfo.significance}

请生成以下内容，严格返回 JSON 格式，不要添加任何其他文字：
{
  "background": "研究背景与动机（300-500字，详细解释这个研究方向的背景、为什么这个问题重要、前人工作的不足）",
  "methods": "核心方法与技术路线（300-500字，详细描述论文的核心方法、技术创新点、算法或模型设计思路）",
  "results": ["主要发现1", "主要发现2", "主要发现3", "主要发现4", "主要发现5"],
  "impact": "学术影响与后续发展（200-300字，分析这篇论文对领域的影响、启发了哪些后续工作、未来发展方向）",
  "relatedPapers": ["相关论文1：简要说明（作者, 年份）", "相关论文2：简要说明（作者, 年份）", "相关论文3：简要说明（作者, 年份）"]
}

注意：
- 所有内容用中文撰写
- 如涉及专业术语，在首次出现时括号附注英文原文
- 内容要专业、准确、有深度
- 只返回 JSON，不要有任何其他文字或 markdown 包裹`;

  const response = await ai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content:
          "你是一名资深学术专家。用户会给你一篇论文的基本信息，你需要生成详细的扩展内容。必须严格返回 JSON 格式的结果，不要添加任何额外的解释文字。",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content || "{}";

  const data = extractJson(text) as unknown as EnrichedContent;

  if (!data.background || !data.methods || !data.results || !data.impact) {
    throw new Error("Missing required fields in AI response");
  }

  return {
    background: data.background,
    methods: data.methods,
    results: Array.isArray(data.results) ? data.results : [],
    impact: data.impact,
    relatedPapers: Array.isArray(data.relatedPapers) ? data.relatedPapers : [],
  };
}

// --- Build enriched TipTap nodes ---

function buildEnrichedNodes(enriched: EnrichedContent): TipTapNode[] {
  const nodes: TipTapNode[] = [];

  nodes.push(horizontalRule());

  // Background
  nodes.push(heading(3, "研究背景与动机"));
  for (const para of enriched.background.split("\n").filter((p) => p.trim())) {
    nodes.push(paragraph(textNode(para.trim())));
  }

  // Methods
  nodes.push(heading(3, "核心方法与技术路线"));
  for (const para of enriched.methods.split("\n").filter((p) => p.trim())) {
    nodes.push(paragraph(textNode(para.trim())));
  }

  // Results
  if (enriched.results.length > 0) {
    nodes.push(heading(3, "主要实验结果与发现"));
    nodes.push(bulletList(enriched.results));
  }

  // Impact
  nodes.push(heading(3, "学术影响与后续发展"));
  for (const para of enriched.impact.split("\n").filter((p) => p.trim())) {
    nodes.push(paragraph(textNode(para.trim())));
  }

  // Related reading
  if (enriched.relatedPapers.length > 0) {
    nodes.push(heading(3, "延伸阅读"));
    nodes.push(bulletList(enriched.relatedPapers));
  }

  return nodes;
}

// --- Main ---

async function main() {
  console.log(`📚 批量扩展文献推荐帖子内容 (限制: 前 ${LIMIT} 篇)\n`);

  // 1. Find all recommendation posts
  const allPosts = await prisma.post.findMany({
    where: { title: { startsWith: POST_TITLE_PREFIX } },
    select: {
      id: true,
      title: true,
      content: true,
      summary: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📊 共找到 ${allPosts.length} 篇文献推荐帖子`);

  // 2. Filter out already enriched posts
  const needsEnrichment: typeof allPosts = [];
  let alreadyEnriched = 0;

  for (const post of allPosts) {
    const content = post.content as { type: string; content: TipTapNode[] };
    if (isEnriched(content)) {
      alreadyEnriched++;
    } else {
      needsEnrichment.push(post);
    }
  }

  console.log(`  ✅ 已扩展: ${alreadyEnriched} 篇`);
  console.log(`  📝 待扩展: ${needsEnrichment.length} 篇`);

  // 3. Apply limit
  const toProcess = needsEnrichment.slice(0, LIMIT);
  if (toProcess.length < needsEnrichment.length) {
    console.log(`  🎯 本次处理: 前 ${toProcess.length} 篇\n`);
  } else {
    console.log(`  🎯 本次处理: 全部 ${toProcess.length} 篇\n`);
  }

  if (toProcess.length === 0) {
    console.log("🎉 没有需要扩展的帖子！");
    return;
  }

  // 4. Process posts
  let success = 0;
  let failed = 0;
  const failedPosts: { title: string; error: string }[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const post = toProcess[i];
    const content = post.content as { type: string; content: TipTapNode[] };
    const paperInfo = extractPaperInfo(content);
    const shortTitle = post.title.slice(0, 50);

    console.log(`[${i + 1}/${toProcess.length}] ${shortTitle}...`);
    console.log(`  📄 ${paperInfo.title.slice(0, 60)}`);

    try {
      // Call AI with retry
      let enriched: EnrichedContent | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`  🤖 调用 Gemma 4 生成扩展内容${attempt > 1 ? ` (重试 #${attempt})` : ""}...`);
          enriched = await generateEnrichedContent(paperInfo);
          break;
        } catch (e) {
          if (attempt === 1) {
            console.log(`  ⚠ 第一次失败: ${(e as Error).message}，5 秒后重试...`);
            await new Promise((r) => setTimeout(r, 5000));
          } else {
            throw e;
          }
        }
      }

      if (!enriched) throw new Error("Failed after retries");

      console.log(`  📝 生成: 背景${enriched.background.length}字, 方法${enriched.methods.length}字, ${enriched.results.length}条结果`);

      // Build new TipTap nodes
      const enrichedNodes = buildEnrichedNodes(enriched);
      const newContent = {
        ...content,
        content: [...content.content, ...enrichedNodes],
      };

      // Update summary
      const newSummary = `${paperInfo.titleZh || paperInfo.title} — ${enriched.background.slice(0, 150)}`;

      // Update database
      await prisma.post.update({
        where: { id: post.id },
        data: {
          content: newContent,
          summary: newSummary.slice(0, 200),
        },
      });

      success++;
      console.log(
        `  ✅ 已更新 (节点: ${content.content.length} → ${newContent.content.length})`
      );
    } catch (e) {
      failed++;
      const errMsg = (e as Error).message;
      failedPosts.push({ title: shortTitle, error: errMsg });
      console.log(`  ❌ 失败: ${errMsg}`);
    }

    // Progress summary every 10 posts
    if ((i + 1) % 10 === 0) {
      console.log(
        `\n  --- 进度: ${i + 1}/${toProcess.length} | 成功: ${success} | 失败: ${failed} ---\n`
      );
    }

    // Rate limit
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 5. Summary
  console.log(`\n🏁 批量扩展完成！`);
  console.log(`  ✅ 成功: ${success} 篇`);
  console.log(`  ❌ 失败: ${failed} 篇`);
  console.log(`  ⏭ 跳过(已扩展): ${alreadyEnriched} 篇`);
  console.log(
    `  📊 总计: ${alreadyEnriched + success}/${allPosts.length} 篇已扩展`
  );

  if (failedPosts.length > 0) {
    console.log(`\n❌ 失败列表:`);
    for (const fp of failedPosts) {
      console.log(`  - ${fp.title}: ${fp.error}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ 脚本执行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
