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
  apiKey: "ollama",
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  timeout: 10 * 60 * 1000, // 10 minutes — Gemma 4 31B can be slow
});
const MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-it-bf16";

const POST_TITLE_PREFIX = "【文献推荐】";

// --- TipTap JSON node builders ---

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

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

// --- Extract text from TipTap JSON ---

function extractTextFromNodes(nodes: TipTapNode[]): string {
  let result = "";
  for (const node of nodes) {
    if (node.text) {
      result += node.text;
    }
    if (node.content) {
      result += extractTextFromNodes(node.content);
    }
  }
  return result;
}

/** Parse existing post content to extract paper metadata */
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

    // H2 = English title
    if (node.type === "heading" && node.attrs?.level === 2) {
      title = extractTextFromNodes(node.content || []);
    }

    // Paragraph with bold label
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

    // H3 sections
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

/** Clean AI response text and parse as JSON object */
function extractJson(text: string): Record<string, unknown> {
  // Strip markdown code fences
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Try to find a JSON object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    cleaned = objMatch[0];
  }

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
  const prompt = `你是一名资深计算机科学领域的学术专家。请基于以下论文信息，生成详细的扩展内容。

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
- 如涉及数学公式，使用 LaTeX 格式
- 内容要专业、准确、有深度，适合研究生及以上水平阅读
- 只返回 JSON，不要有任何其他文字或 markdown 包裹`;

  console.log("  🤖 调用 Gemma 4 生成扩展内容...");

  const response = await ai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 16000,
    messages: [
      {
        role: "system",
        content:
          "你是一名计算机科学领域的资深学术专家。用户会给你一篇论文的基本信息，你需要生成详细的扩展内容。必须严格返回 JSON 格式的结果，不要添加任何额外的解释文字。",
      },
      { role: "user", content: prompt },
    ],
  });

  const text = response.choices[0]?.message?.content || "{}";
  console.log(`  📝 收到响应 (${text.length} 字符)`);

  try {
    const data = extractJson(text) as unknown as EnrichedContent;

    // Validate required fields
    if (!data.background || !data.methods || !data.results || !data.impact) {
      throw new Error("Missing required fields in response");
    }

    return {
      background: data.background,
      methods: data.methods,
      results: Array.isArray(data.results) ? data.results : [],
      impact: data.impact,
      relatedPapers: Array.isArray(data.relatedPapers)
        ? data.relatedPapers
        : [],
    };
  } catch (e) {
    console.error(`  ❌ JSON 解析失败: ${(e as Error).message}`);
    console.error(`  原始响应 (前 500 字符): ${text.slice(0, 500)}`);
    throw e;
  }
}

/** Build enriched TipTap nodes from AI-generated content */
function buildEnrichedNodes(enriched: EnrichedContent): TipTapNode[] {
  const nodes: TipTapNode[] = [];

  // Divider
  nodes.push(horizontalRule());

  // Background
  nodes.push(heading(3, "研究背景与动机"));
  // Split by newlines for multi-paragraph support
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
  console.log("📚 扩展计算机学科第一篇文献推荐帖子内容\n");

  // 1. Find computer science subject account
  const user = await prisma.user.findUnique({
    where: { email: "subject-520@academic.local" },
    select: { id: true, displayName: true },
  });

  if (!user) {
    console.error("❌ 找不到计算机学科账号 (subject-520@academic.local)");
    process.exit(1);
  }
  console.log(`✅ 找到学科账号: ${user.displayName}`);

  // 2. Find the first recommendation post
  const post = await prisma.post.findFirst({
    where: {
      authorId: user.id,
      title: { startsWith: POST_TITLE_PREFIX },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, content: true, summary: true },
  });

  if (!post) {
    console.error("❌ 找不到文献推荐帖子");
    process.exit(1);
  }
  console.log(`✅ 找到帖子: ${post.title}`);
  console.log(`  ID: ${post.id}\n`);

  // 3. Extract paper info from existing content
  const content = post.content as { type: string; content: TipTapNode[] };
  const paperInfo = extractPaperInfo(content);

  console.log("📋 现有论文信息:");
  console.log(`  标题: ${paperInfo.title}`);
  console.log(`  中文: ${paperInfo.titleZh}`);
  console.log(`  作者: ${paperInfo.authors}`);
  console.log(`  发表: ${paperInfo.venue}`);
  console.log(`  摘要: ${paperInfo.abstract.slice(0, 80)}...`);
  console.log(`  推荐: ${paperInfo.significance.slice(0, 80)}...`);
  console.log();

  // 4. Call Gemma 4 to generate enriched content
  const enriched = await generateEnrichedContent(paperInfo);

  console.log("\n✅ 生成扩展内容:");
  console.log(`  研究背景: ${enriched.background.slice(0, 60)}...`);
  console.log(`  核心方法: ${enriched.methods.slice(0, 60)}...`);
  console.log(`  实验结果: ${enriched.results.length} 条`);
  console.log(`  学术影响: ${enriched.impact.slice(0, 60)}...`);
  console.log(`  延伸阅读: ${enriched.relatedPapers.length} 篇`);
  console.log();

  // 5. Build new TipTap nodes and merge into existing content
  const enrichedNodes = buildEnrichedNodes(enriched);

  const newContent = {
    ...content,
    content: [...content.content, ...enrichedNodes],
  };

  // Update summary with richer description
  const newSummary = `${paperInfo.titleZh || paperInfo.title} — ${enriched.background.slice(0, 150)}`;

  // 6. Update database
  await prisma.post.update({
    where: { id: post.id },
    data: {
      content: newContent,
      summary: newSummary.slice(0, 200),
    },
  });

  console.log("✅ 数据库已更新!");
  console.log(
    `  原始节点数: ${content.content.length} → 新节点数: ${newContent.content.length}`
  );
  console.log(`  新 summary: ${newSummary.slice(0, 100)}...`);
}

main()
  .catch((e) => {
    console.error("❌ 脚本执行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
