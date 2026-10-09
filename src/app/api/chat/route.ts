import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import {
  weatherTools,
  datetimeTools,
  calculatorTools,
  searchTools,
  currencyTools,
} from "@/tools";

const MODEL = process.env.MODEL_GROQ as string

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = streamText({
      model: groq(MODEL),
      messages: await convertToModelMessages(messages),
      system:
        "Bạn là một AI assistant hữu ích với khả năng tra thời tiết, tính toán, tìm kiếm web và chuyển đổi tiền tệ. Luôn dùng tools khi người dùng hỏi về thời tiết, tính toán, tìm kiếm hoặc đổi tiền. Trả lời bằng ngôn ngữ của người dùng.",
      tools: {
        ...weatherTools,
        ...datetimeTools,
        ...calculatorTools,
        ...searchTools,
        ...currencyTools,
      },
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
