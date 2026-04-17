import { NextRequest, NextResponse } from "next/server";
import { summarizePost } from "@/services/ai.service";

// POST /api/ai/summarize — Stream AI summary of post content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "标题和内容不能为空" },
        { status: 400 }
      );
    }

    // Convert TipTap JSON to plain text for the AI
    const plainText =
      typeof content === "string" ? content : extractText(content);

    const stream = await summarizePost(title, plainText);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "AI 服务暂时不可用";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Extract plain text from TipTap JSON content
 */
function extractText(node: Record<string, unknown>): string {
  if (!node) return "";

  if (node.type === "text") {
    return (node.text as string) || "";
  }

  const content = node.content as Record<string, unknown>[] | undefined;
  if (Array.isArray(content)) {
    return content.map(extractText).join("\n");
  }

  return "";
}
