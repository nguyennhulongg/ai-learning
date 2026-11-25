import { streamText, convertToModelMessages, isStepCount, type UIMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";

import { financialTools } from "@/tools/financials";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// Gọi nhiều tool liên tiếp mất thời gian hơn một câu trả lời thường.
export const maxDuration = 60;

// Số tin nhắn gần nhất gửi kèm, đủ để hiểu ngữ cảnh mà không vượt giới hạn token.
const HISTORY_LIMIT = 12;

// Số bước tối đa trong một lượt trả lời. Mỗi bước, model gọi tool hoặc viết câu trả lời;
// giới hạn này chặn vòng lặp gọi tool vô tận.
const MAX_STEPS = 6;

const SYSTEM_PROMPT = `Bạn là trợ lý phân tích báo cáo tài chính doanh nghiệp niêm yết Việt Nam. Trả lời bằng ngôn ngữ của người dùng.

Quy tắc về số liệu:
- Mọi con số phải lấy từ tool. Không tự nhớ, không ước lượng, không tự tính kể cả phép trừ hay phần trăm; cần chỉ số thì gọi calculateRatios, so sánh các kỳ thì gọi comparePeriods.
- Người dùng nêu tên công ty thì gọi findCompanies để lấy mã trước.
- getFinancials chỉ có các chỉ tiêu chính. Chỉ tiêu khác (ví dụ doanh thu chưa thực hiện, phải thu, chi phí trả trước) thì gọi searchLineItems; chỉ nói "không có" sau khi đã thử vài từ khoá khác nhau.
- Tool báo chưa có dữ liệu thì nói rõ là chưa có, kèm các kỳ đang có, và gợi ý upload file PDF báo cáo. Không thay bằng số của kỳ khác.
- Phân biệt rõ số của một quý với số luỹ kế cả năm, và báo cáo hợp nhất với báo cáo công ty mẹ.
- Ghi đơn vị (tỷ đồng) và trích nguồn ở cuối câu trả lời theo dạng: Nguồn: tên file, trang N.
- value là số đã đổi sang tỷ đồng và làm tròn; exact (hoặc exactValues) là số đúng như in trong báo cáo. Bảng số liệu có cột "Tỷ đồng" lấy từ value và cột "Số trong báo cáo" chép nguyên exact, để người dùng đối chiếu với PDF. Không tự làm tròn hay đổi đơn vị của exact.
- Số có verified=false là số máy đọc từ PDF chưa được đối chiếu; nhắc người dùng điều này một lần khi dùng các số đó.
- Chỉ so sánh với số liệu có trong kết quả tool. Không so với con số bạn tự nhớ, kể cả số "thường thấy" của công ty.
- Đọc kỹ trường warnings trong kết quả tool và nêu lại cho người dùng.

Số đầu năm và thuyết minh:
- Dòng bảng cân đối có trường opening là số đầu năm tài chính in trong báo cáo kỳ này, opening.change là thay đổi từ đầu năm đã tính sẵn. Hỏi thay đổi từ đầu năm thì dùng opening.change, không lấy số cuối năm trước từ báo cáo năm trước, vì số đầu năm có thể đã được phân loại lại.
- Người dùng hỏi chi tiết, thành phần, lý do tăng giảm của một dòng thì gọi readNotes với tên dòng hoặc tên mục làm từ khoá. Trường note (ví dụ "VI.3") cho biết dòng có mục thuyết minh riêng; có thể nhắc mã này cho người dùng. Không thấy gì thì thử từ khoá ngắn hơn hoặc một tiêu đề trong headings.
- Đoạn thuyết minh là văn bản OCR có thể sai chữ, sai số hoặc lệch cột. Chỉ trích số đọc rõ ràng, ghi trang, không tự cộng trừ các số trong đó, và không đoán phần bị hỏng.
- Không tự suy đoán lý do biến động (ví dụ "có thể do cho vay..."). Lý do chỉ lấy từ thuyết minh; đã gọi readNotes mà không có thì nói thuyết minh không giải thích.

Không đưa tên trường kỹ thuật (opening.change, verified, bs_210, metric...) vào câu trả lời; diễn đạt bằng lời, ví dụ "số đầu năm", "chưa được đối chiếu tự động". Mã thuyết minh như "VI.3" thì được nhắc.

Trình bày: tóm tắt ngắn trước, bảng số liệu sau nếu có nhiều chỉ tiêu, rồi nhận xét ngắn.`;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;

    // Giới hạn token theo thời gian của gói miễn phí: không phải tin nhắn quá dài,
    // chỉ cần chờ rồi gửi lại. Kiểm tra trước vì thông báo này cũng có cụm "Limit ... Requested".
    if (msg.includes("tokens per minute")) {
      const seconds = msg.match(/try again in ([\d.]+)s/i)?.[1];
      const wait = seconds ? `khoảng ${Math.ceil(Number(seconds))} giây` : "vài giây";
      return `Đã chạm giới hạn token mỗi phút của model AI. Vui lòng chờ ${wait} rồi gửi lại.`;
    }
    if (msg.includes("tokens per day"))
      return "Đã hết hạn mức token trong ngày của model AI. Vui lòng thử lại vào ngày mai.";

    // Token/context quá dài — check trước vì Groq đôi khi trả "does not exist"
    // kèm theo "Request too large" hoặc "tokens per minute"
    if (
      msg.includes("context_length_exceeded") ||
      msg.includes("maximum context length") ||
      msg.includes("too long") ||
      msg.includes("Request too large") ||
      msg.includes("reduce your message size") ||
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


// Giữ các tin gần nhất để model hiểu câu hỏi nối tiếp, ví dụ "còn quý 3 thì sao?".
// Tin cũ chỉ giữ phần chữ: kết quả tool đã được tóm tắt trong câu trả lời,
// gửi lại nguyên bảng số sẽ tốn token mà không thêm thông tin.
function trimHistory(messages: UIMessage[]): UIMessage[] {
  const recent = messages.slice(-HISTORY_LIMIT);
  return recent.map((message, index) =>
    index === recent.length - 1
      ? message
      : { ...message, parts: message.parts.filter((part) => part.type === "text") },
  );
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const recentMessages = trimHistory(messages);

    const result = streamText({
      model: groq(process.env.MODEL_GROQ ?? "llama-3.3-70b-versatile"),
      messages: (await convertToModelMessages(recentMessages)).filter(
        (m) => m.content !== undefined && m.content !== "" &&
          !(Array.isArray(m.content) && m.content.length === 0)
      ),
      system: SYSTEM_PROMPT,
      tools: financialTools,
      stopWhen: isStepCount(MAX_STEPS),
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
