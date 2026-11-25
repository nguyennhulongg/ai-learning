"use client";

import {
  getToolName,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";

// Nhãn hiển thị cho từng tool. Key là tên tool khai báo trong src/tools/financials.ts.
// Tool chưa có trong bảng sẽ hiện nguyên tên tool (fallback), nên thêm tool mới không làm vỡ UI.
const TOOL_LABELS: Record<string, string> = {
  findCompanies: "Finding companies",
  listReports: "Listing reports",
  getFinancials: "Reading financials",
  searchLineItems: "Searching line items",
  readNotes: "Reading notes",
  calculateRatios: "Calculating ratios",
  comparePeriods: "Comparing periods",
  compareCompanies: "Comparing companies",
};

const THINKING_LABEL = "Thinking";

// Suy ra "AI đang làm gì" từ danh sách tin nhắn.
// - "part" = một mảnh của tin nhắn AI SDK: text, reasoning (suy luận), tool-<tên> (lời gọi tool),
//   step-start (đánh dấu bắt đầu một vòng model mới). Part mới luôn được nối vào cuối mảng.
// - Vì vậy chỉ cần nhìn part cuối cùng là biết trạng thái hiện tại.
// Trả về null khi không cần hiện gì (không loading, hoặc chữ trả lời đang chảy ra rồi).
export function getActivityLabel(
  messages: UIMessage[],
  isLoading: boolean,
): string | null {
  if (!isLoading) return null;

  const last = messages[messages.length - 1];
  // status "submitted": request đã gửi nhưng server chưa trả part nào → tin cuối vẫn là của user.
  if (!last || last.role !== "assistant") return THINKING_LABEL;

  // step-start không mang nội dung, bỏ qua để nhìn thấy part có ý nghĩa phía trước.
  const parts = last.parts.filter((part) => part.type !== "step-start");
  const lastPart = parts[parts.length - 1];
  if (!lastPart) return THINKING_LABEL;

  if (isToolUIPart(lastPart)) {
    // input-streaming: model đang viết tham số; input-available: server đang chạy tool.
    // Các state khác (output-available, output-error...) nghĩa là tool xong, model đang nghĩ bước tiếp.
    if (lastPart.state === "input-streaming" || lastPart.state === "input-available") {
      const name = getToolName(lastPart);
      return TOOL_LABELS[name] ?? name;
    }
    return THINKING_LABEL;
  }

  if (isReasoningUIPart(lastPart)) return THINKING_LABEL;

  // Chữ trả lời đã bắt đầu hiện → bản thân chữ là tín hiệu tiến độ, ẩn indicator.
  if (isTextUIPart(lastPart)) return lastPart.text ? null : THINKING_LABEL;

  return THINKING_LABEL;
}

type ActivityIndicatorProps = {
  label: string;
};

// Dòng trạng thái duy nhất, có hiệu ứng shimmer (vệt sáng chạy từ trái qua phải trên chữ).
// key={label}: khi nhãn đổi (Thinking → Reading financials), React hủy span cũ và gắn span mới,
// nên chữ cũ biến mất và chữ mới hiện vào đúng vị trí, kèm animation fade-in chạy lại từ đầu.
export default function ActivityIndicator({ label }: ActivityIndicatorProps) {
  return (
    <div className="px-1 text-[15px]" role="status" aria-live="polite">
      <span key={label} className="activity-label shimmer-text">
        {label}...
      </span>
    </div>
  );
}
