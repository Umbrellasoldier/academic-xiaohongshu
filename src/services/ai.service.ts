import OpenAI from "openai";

// Ollama API — compatible with OpenAI SDK
// Lazy init — only created when actually called
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const baseURL = process.env.OLLAMA_BASE_URL;
    if (!baseURL) {
      throw new Error("OLLAMA_BASE_URL 环境变量未设置");
    }
    _client = new OpenAI({
      apiKey: "ollama", // Ollama 不需要真实 API Key，但 SDK 要求非空
      baseURL,
    });
  }
  return _client;
}

const MODEL = process.env.OLLAMA_MODEL || "gemma4:31b-it-bf16";

/**
 * Summarize a post's content into 3-5 bullet points.
 * Returns a ReadableStream for streaming output.
 */
export async function summarizePost(
  title: string,
  content: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    stream: true,
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      {
        role: "system",
        content: `你是一名学术助手。请用中文将以下学术笔记总结为3-5个要点。
要求：
- 每个要点用 "• " 开头
- 保留关键术语和数据
- 如果有数学公式，保留 LaTeX 格式（$...$）
- 简洁明了，每个要点不超过2句话
- 最后用一句话给出总评`,
      },
      {
        role: "user",
        content: `标题：${title}\n\n内容：${content}`,
      },
    ],
  });

  return openAIStreamToReadable(response);
}

/**
 * Translate academic text while preserving LaTeX formulas and citation references.
 */
export async function translateAcademic(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    stream: true,
    temperature: 0.2,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `你是一名专业学术翻译。请将以下学术文本从${sourceLang}翻译为${targetLang}。
严格要求：
- 保留所有 LaTeX 数学公式（$...$  和 $$...$$），不翻译公式内容
- 保留所有引用标记（如 [1], [Author, Year] 等），不改变引用格式
- 保留专业术语的准确性，必要时在括号中附注原文
- 保持原文的段落结构和格式
- 学术用语要规范、正式`,
      },
      {
        role: "user",
        content: text,
      },
    ],
  });

  return openAIStreamToReadable(response);
}

/**
 * Generate content recommendations based on user interests.
 * Non-streaming — returns structured JSON.
 */
export async function getRecommendations(
  userInterests: string[],
  recentPosts: { title: string; subject: string }[]
): Promise<string[]> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    max_tokens: 1000,
    messages: [
      {
        role: "system",
        content: `基于用户的兴趣和最近浏览过的帖子，生成5个推荐搜索关键词。
必须严格返回 JSON 格式，不要添加任何其他文字：{ "keywords": ["keyword1", "keyword2", ...] }`,
      },
      {
        role: "user",
        content: `用户兴趣：${userInterests.join(", ")}
最近浏览：${recentPosts.map((p) => `[${p.subject}] ${p.title}`).join("\n")}`,
      },
    ],
  });

  try {
    let text = response.choices[0]?.message?.content || "{}";
    // Strip markdown code fences (e.g. ```json ... ```)
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const data = JSON.parse(text);
    return data.keywords || [];
  } catch {
    return [];
  }
}

// --- Stream helper ---

function openAIStreamToReadable(
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
