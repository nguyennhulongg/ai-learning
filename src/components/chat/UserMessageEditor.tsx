"use client";

import { useState } from "react";
import { Button, Input } from "antd";

type UserMessageEditorProps = {
  initialText: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
};

// Khung sửa tin nhắn, hiện tại chỗ bong bóng tin nhắn khi bấm nút Sửa.
// Phím tắt: Enter = gửi, Shift+Enter = xuống dòng, Esc = hủy (giống ô nhập chính).
export default function UserMessageEditor({
  initialText,
  onCancel,
  onSubmit,
}: UserMessageEditorProps) {
  const [draft, setDraft] = useState(initialText);

  const trimmed = draft.trim();
  // Không cho gửi khi rỗng hoặc chưa sửa gì — gửi lại y nguyên chỉ tốn một lượt gọi AI.
  const canSubmit = trimmed.length > 0 && trimmed !== initialText.trim();

  // Gửi nội dung đã sửa (bỏ khoảng trắng thừa ở hai đầu).
  const submit = () => {
    if (canSubmit) onSubmit(trimmed);
  };

  // Xử lý phím tắt trong ô soạn.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col items-end gap-2 w-full">
      <div
        className="w-full max-w-[80%] rounded-3xl px-4 py-2"
        style={{
          background: "var(--bg-surface-user)",
          border: "1px solid rgba(252, 252, 252, 0.12)",
        }}
      >
        <Input.TextArea
          autoFocus
          variant="borderless"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          // Đặt con trỏ ở cuối đoạn chữ thay vì đầu, để gõ tiếp cho tiện.
          onFocus={(e) => {
            const end = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(end, end);
          }}
          autoSize={{ minRows: 1, maxRows: 10 }}
          style={{
            color: "var(--text-primary)",
            fontSize: "15px",
            padding: 0,
            lineHeight: 1.625,
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button size="small" onClick={onCancel} style={{ background: "transparent" }}>
          Hủy
        </Button>
        <Button
          size="small"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            background: "var(--bg-surface-user)",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          Gửi
        </Button>
      </div>
    </div>
  );
}
