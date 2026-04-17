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
  timeout: 5 * 60 * 1000, // 5 minutes
});
const MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-it-bf16";

const POST_TITLE_PREFIX = "【文献推荐】";

// --- TipTap types ---

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
}

interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}

// --- Helpers ---

function extractTextFromNodes(nodes: TipTapNode[]): string {
  let result = "";
  for (const node of nodes) {
    if (node.text) result += node.text;
    if (node.content) result += extractTextFromNodes(node.content);
  }
  return result;
}

/** Check if a post's TipTap content already has a DOI paragraph with a link */
function hasDoi(doc: TipTapDoc): { hasDoi: boolean; doi: string | null } {
  for (const node of doc.content) {
    if (node.type !== "paragraph" || !node.content) continue;
    const fullText = extractTextFromNodes(node.content);
    if (!fullText.startsWith("DOI：")) continue;

    // Found DOI label — check for link mark
    for (const child of node.content) {
      if (child.marks?.some((m) => m.type === "link")) {
        return { hasDoi: true, doi: child.text || null };
      }
    }
    // Has DOI label but no link — malformed
    return { hasDoi: false, doi: null };
  }
  return { hasDoi: false, doi: null };
}

/** Extract paper metadata from TipTap content */
function extractPaperMeta(doc: TipTapDoc): {
  title: string;
  titleZh: string;
  authors: string;
  venue: string;
} {
  let title = "";
  let titleZh = "";
  let authors = "";
  let venue = "";

  for (const node of doc.content) {
    if (node.type === "heading" && node.attrs?.level === 2) {
      title = extractTextFromNodes(node.content || []);
    }
    if (node.type === "paragraph" && node.content) {
      const text = extractTextFromNodes(node.content);
      if (text.startsWith("中文标题：")) titleZh = text.replace("中文标题：", "");
      else if (text.startsWith("作者：")) authors = text.replace("作者：", "");
      else if (text.startsWith("发表：")) venue = text.replace("发表：", "");
    }
  }

  return { title, titleZh, authors, venue };
}

/** Build TipTap DOI paragraph node with a clickable link */
function buildDoiNode(doi: string): TipTapNode {
  return {
    type: "paragraph",
    content: [
      { type: "text", marks: [{ type: "bold" }], text: "DOI：" },
      {
        type: "text",
        marks: [
          {
            type: "link",
            attrs: {
              href: `https://doi.org/${doi}`,
              target: "_blank",
            },
          },
        ],
        text: doi,
      },
    ],
  };
}

/** Insert DOI node after the "发表：" paragraph */
function insertDoiNode(doc: TipTapDoc, doi: string): TipTapDoc {
  const newContent: TipTapNode[] = [];
  let inserted = false;

  for (const node of doc.content) {
    newContent.push(node);

    // Insert DOI right after the "发表：" paragraph
    if (!inserted && node.type === "paragraph" && node.content) {
      const text = extractTextFromNodes(node.content);
      if (text.startsWith("发表：")) {
        newContent.push(buildDoiNode(doi));
        inserted = true;
      }
    }
  }

  return { ...doc, content: newContent };
}

/** Call Gemma 4 to look up DOI for a paper */
async function lookupDoi(
  title: string,
  authors: string,
  venue: string
): Promise<string | null> {
  const prompt = `请查找以下学术论文的 DOI（数字对象标识符）：

论文标题：${title}
作者：${authors}
发表信息：${venue}

请只返回 DOI 字符串（格式如 "10.xxxx/xxxxx"），不要添加任何其他文字。
如果这是一篇 arXiv 预印本，请返回对应的 arXiv DOI（格式如 "10.48550/arXiv.xxxx.xxxxx"）。
如果确实无法确定 DOI，只返回 "null"（不带引号）。`;

  const response = await ai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content:
          "你是一个学术文献 DOI 查询工具。用户给你论文信息，你返回该论文的 DOI。只返回 DOI 字符串，不要其他任何文字。",
      },
      { role: "user", content: prompt },
    ],
  });

  let text = (response.choices[0]?.message?.content || "").trim();

  // Strip thinking tags
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Strip markdown code fences
  text = text.replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  // Strip quotes
  text = text.replace(/^["']|["']$/g, "").trim();

  // Validate DOI format
  if (text === "null" || text === "NULL" || text === "") return null;

  // DOI must start with 10.
  const doiMatch = text.match(/10\.\d{4,}[\w./-]+/);
  if (doiMatch) return doiMatch[0];

  return null;
}

// --- Main ---

async function main() {
  console.log("🔍 扫描文献推荐帖子 DOI 链接状态\n");

  // 1. Find all recommendation posts
  const posts = await prisma.post.findMany({
    where: { title: { startsWith: POST_TITLE_PREFIX } },
    select: {
      id: true,
      title: true,
      content: true,
      author: { select: { displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📊 共找到 ${posts.length} 篇文献推荐帖子\n`);

  let withDoi = 0;
  let withoutDoi = 0;
  const missingDoiPosts: {
    id: string;
    title: string;
    meta: ReturnType<typeof extractPaperMeta>;
    content: TipTapDoc;
  }[] = [];

  // 2. Scan all posts
  for (const post of posts) {
    const doc = post.content as TipTapDoc;
    const result = hasDoi(doc);

    if (result.hasDoi) {
      withDoi++;
      console.log(`  ✅ ${post.title.slice(0, 50)}  →  DOI: ${result.doi}`);
    } else {
      withoutDoi++;
      const meta = extractPaperMeta(doc);
      missingDoiPosts.push({ id: post.id, title: post.title, meta, content: doc });
      console.log(`  ❌ ${post.title.slice(0, 50)}  →  缺少 DOI`);
    }
  }

  console.log(`\n📊 统计: ${withDoi} 篇有 DOI, ${withoutDoi} 篇缺少 DOI\n`);

  if (missingDoiPosts.length === 0) {
    console.log("🎉 所有帖子都已有 DOI 链接，无需修复！");
    return;
  }

  // 3. Fix missing DOI posts
  console.log(`🔧 开始修复 ${missingDoiPosts.length} 篇缺少 DOI 的帖子...\n`);

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < missingDoiPosts.length; i++) {
    const post = missingDoiPosts[i];
    const { title, authors, venue } = post.meta;

    console.log(
      `  [${i + 1}/${missingDoiPosts.length}] ${post.title.slice(0, 40)}...`
    );
    console.log(`    📄 ${title}`);

    try {
      const doi = await lookupDoi(title, authors, venue);

      if (doi) {
        // Insert DOI node into TipTap content
        const newDoc = insertDoiNode(post.content, doi);

        await prisma.post.update({
          where: { id: post.id },
          data: { content: newDoc },
        });

        fixed++;
        console.log(`    ✅ 找到 DOI: ${doi} → 已更新`);
      } else {
        failed++;
        console.log(`    ⚠️  未能找到 DOI，跳过`);
      }
    } catch (e) {
      failed++;
      console.log(`    ❌ 错误: ${(e as Error).message}`);
    }

    // Rate limit — 2s pause between AI calls
    if (i < missingDoiPosts.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n🏁 修复完成！`);
  console.log(`  ✅ 成功修复: ${fixed} 篇`);
  console.log(`  ⚠️  未能修复: ${failed} 篇`);
  console.log(`  📊 最终: ${withDoi + fixed}/${posts.length} 篇有 DOI 链接`);
}

main()
  .catch((e) => {
    console.error("❌ 脚本执行失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
