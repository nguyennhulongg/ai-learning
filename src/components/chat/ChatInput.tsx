"use client";

import { useRef, useState, useEffect } from "react";
import { Button, ConfigProvider, theme, UploadFile } from "antd";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhắn tin..."
              disabled={disabled}
              style={{
                color: "var(--text-primary)",
                gridArea: "textarea",
              }}
              className="w-full min-w-0 bg-transparent
                resize-none
                outline-none h-auto leading-relaxed disabled:opacity-50
                text-[17px]"
            />

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
