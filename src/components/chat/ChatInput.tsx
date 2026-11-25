"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { AutoComplete, Button, ConfigProvider, theme, UploadFile } from "antd";
import { useSuggestionCatalog } from "@/features/suggestions/suggestions.queries";
import { getInputSuggestions } from "@/features/suggestions/suggest";
import FileCard from "./FileCard";
import UploadButton from "./UploadButton";


interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export type UploadedFile = UploadFile

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  // Thẻ bọc textarea. AutoComplete ghi đè ref của textarea, nên tìm textarea qua thẻ bọc này.
  const textareaWrapperRef = useRef<HTMLDivElement>(null);

  // ----- Gợi ý khi gõ (mã cổ phiếu, kỳ báo cáo), lấy từ DB, không gọi AI -----
  const { data: catalog } = useSuggestionCatalog();
  const [isFocused, setIsFocused] = useState(false);
  // Nội dung ô nhập lúc người dùng đóng danh sách (Esc, bấm ra ngoài).
  // Giữ đóng cho tới khi họ gõ thêm, để danh sách không bật lại ngay lập tức.
  const [dismissedText, setDismissedText] = useState<string | null>(null);

  const suggestions = useMemo(() => getInputSuggestions(value, catalog), [value, catalog]);
  const isSuggestOpen =
    isFocused && !disabled && suggestions.length > 0 && dismissedText !== value;

  // Mỗi gợi ý thành một option của AutoComplete.
  // value = toàn bộ nội dung ô nhập sau khi chọn, nên chọn xong AutoComplete chỉ cần gọi onChange(value).
  const suggestionOptions = suggestions.map((s) => ({
    value: s.nextText,
    label: (
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="font-[550] shrink-0">{s.title}</span>
        <span className="truncate text-xs opacity-60">{s.description}</span>
      </div>
    ),
  }));

  // Tự giãn chiều cao textarea theo nội dung, tối đa 160px rồi cuộn.
  useEffect(() => {
    const el = textareaWrapperRef.current?.querySelector("textarea");
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  // Phím trong ô nhập. Handler này chạy TRƯỚC handler của AutoComplete.
  // Khi danh sách gợi ý đang mở: Enter/Tab để AutoComplete chọn gợi ý (không gửi tin),
  // mũi tên lên/xuống để chọn dòng (chặn việc di chuyển con trỏ trong textarea).
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSuggestOpen) {
      if (e.key === "Enter" || e.key === "Tab") return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRemoveFile = (uid: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.uid !== uid));
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorBgElevated: "var(--bg-surface-ai)",
          colorText: "var(--text-primary)",
          colorBgContainer: "var(--bg-surface-ai)",
          // Nền dòng gợi ý khi rê chuột / đang được chọn bằng phím mũi tên.
          controlItemBgHover: "rgba(252, 252, 252, 0.06)",
          controlItemBgActive: "rgba(252, 252, 252, 0.1)",
        },
      }}
    >
      <div className="px-3 pb-6">
        <div className="max-w-197 w-full mx-auto">
          <div
            style={{
              background: "var(--bg-surface-ai)",
              display: "grid",
              gridTemplateColumns:
                uploadedFiles.length > 0
                  ? "minmax(0, 1fr) auto"
                  : "auto minmax(0, 1fr) auto",
              gridTemplateAreas:
                uploadedFiles.length > 0
                  ? '"files files" "textarea textarea" "upload send"'
                  : '"upload textarea send"',
              alignItems: "center",
              gap: "8px",
              border: "1px solid rgba(252, 252, 252, 0.06)",
            }}
            className={
              `min-h-13 ${uploadedFiles.length > 0
                ? "rounded-[30px] px-4 py-2"
                : "rounded-[30px] px-4 py-2"}`
            }
          >
            {uploadedFiles.length > 0 && (
              <div
                style={{ gridArea: "files" }}
                className="flex gap-2"
              >
                {uploadedFiles.map((file, index) => (
                  <FileCard
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </div>
            )}

            <div style={{ gridArea: "upload" }}>
              <UploadButton
                popoverOpen={popoverOpen}
                onPopoverOpenChange={setPopoverOpen}
                handleUpload={setUploadedFiles}
                uploadedFiles={uploadedFiles}
              />
            </div>

            <div
              ref={textareaWrapperRef}
              style={{ gridArea: "textarea" }}
              className="min-w-0"
            >
              {/* AutoComplete bọc textarea có sẵn (customize input): giữ nguyên giao diện ô nhập,
                  chỉ thêm danh sách gợi ý bật lên phía trên. open do mình tự tính (isSuggestOpen). */}
              <AutoComplete
                value={value}
                onChange={(next: string) => setValue(next)}
                options={suggestionOptions}
                open={isSuggestOpen}
                onOpenChange={(open) => {
                  if (!open) setDismissedText(value);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                // Tab/Enter chọn ngay dòng đầu, không cần bấm mũi tên trước.
                defaultActiveFirstOption
                // Ô nhập nằm sát đáy màn hình nên danh sách bật lên phía trên.
                placement="topLeft"
                popupMatchSelectWidth={360}
                disabled={disabled}
                // Bỏ viền + viền focus mà AutoComplete tự vẽ quanh ô nhập.
                variant="borderless"
                style={{ width: "100%" }}
              >
                <textarea
                  rows={1}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhắn tin..."
                  disabled={disabled}
                  style={{ color: "var(--text-primary)" }}
                  className="w-full min-w-0 bg-transparent
                    resize-none
                    outline-none h-auto leading-relaxed disabled:opacity-50
                    text-[15px]"
                />
              </AutoComplete>
            </div>

            <Button
              type="primary"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              aria-label="Gửi tin nhắn"
              icon={
                <svg
                  className="w-4 h-4 rotate-270"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              }
              style={{
                gridArea: "send",
                background:
                  !value.trim() || disabled
                    ? "var(--bg-surface-ai)"
                    : "var(--bg-surface-user)",
                color:
                  !value.trim() || disabled
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
              }}
              className="w-8 h-8 rounded-full flex items-center
        justify-center shrink-0"
            />
          </div>
        </div>

      </div>
    </ConfigProvider>
  );
}
