import { streamText, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { rag } from "@/tools";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 30;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;

    // Token/context quá dài — check trước vì Groq đôi khi trả "does not exist"
    // kèm theo "Request too large" hoặc "tokens per minute"
    if (
      msg.includes("context_length_exceeded") ||
      msg.includes("maximum context length") ||
      msg.includes("too long") ||
      msg.includes("Request too large") ||
      msg.includes("reduce your message size") ||
      msg.includes("tokens per minute") ||
      msg.includes("tokens per day") ||
      /Requested \d+.*Limit \d+/i.test(msg) ||
      /Limit \d+.*Requested \d+/i.test(msg)
    ) {
      const match = msg.match(/Limit ([\d,]+), Requested ([\d,]+)/i);
      if (match) {
        return `Tin nhắn quá dài (${Number(match[2].replace(/,/g, "")).toLocaleString()} tokens, giới hạn ${Number(match[1].replace(/,/g, "")).toLocaleString()}). Vui lòng rút gọn nội dung và thử lại.`;
      }
      return "Tin nhắn quá dài, vượt quá giới hạn của model. Vui lòng rút gọn nội dung và thử lại.";
    }
    if (msg.includes("rate_limit") || msg.includes("rate limit"))
      return "Đã vượt quá giới hạn yêu cầu. Vui lòng chờ vài giây rồi thử lại.";
    if (msg.includes("invalid_api_key") || msg.includes("Authentication"))
      return "API key không hợp lệ. Vui lòng kiểm tra cấu hình.";
    // model_not_found — chỉ match khi KHÔNG phải lỗi token
    if (msg.includes("model_not_found") || msg.includes("does not exist"))
      return "Model không khả dụng. Vui lòng thử lại sau.";
    if (msg.includes("network") || msg.includes("fetch"))
      return "Lỗi kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.";
    return `Đã xảy ra lỗi: ${msg}`;
  }
  return "Đã xảy ra lỗi không xác định.";
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Only send the last user message to avoid token limit issues
    // This is a simple fix - for production, you'd want smarter context management
    const lastUserMessage = messages.filter((m: { role: string }) => m.role === "user").slice(-1);

    const result = streamText({
      model: groq(process.env.MODEL_GROQ ?? "llama-3.3-70b-versatile"),
      messages: (await convertToModelMessages(lastUserMessage)).filter(
        (m) => m.content !== undefined && m.content !== "" &&
          !(Array.isArray(m.content) && m.content.length === 0)
      ),
      system:
        "Bạn là một AI assistant hữu ích với khả năng tìm kiếm thông tin trong cơ sở dữ liệu. Sử dụng tool searchKnowledgeBase khi người dùng yêu cầu tìm kiếm thông tin cụ thể. KHÔNG sử dụng tool khi người dùng yêu cầu không tìm trong cơ sở dữ liệu. Trả lời bằng ngôn ngữ của người dùng.",
      tools: {
        ...rag
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (err) => getErrorMessage(err),
    });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return new Response(
      JSON.stringify({ error: getErrorMessage(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
