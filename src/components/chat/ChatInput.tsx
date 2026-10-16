"use client";

import { useRef, useState, useEffect } from "react";
import { Button, ConfigProvider, theme } from "antd";
import FileCard from "./FileCard";
import UploadButton from "./UploadButton";
import { v4 as uuidv4 } from "uuid";


interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export type UploadedFile = File & { isLoading?: boolean, id: string }

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uuid = uuidv4();

    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...newFiles.map((file) => ({ ...file, isLoading: true, id: uuid }))]);
    setPopoverOpen(false);

    try {
      const formData = new FormData();
      formData.append("file", newFiles[newFiles.length - 1]);
      formData.append("id", uuid);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      setUploadedFiles((prev) =>
        prev.map((file) =>
          data.id === uuid ? { ...data, isLoading: false } : file
        )
      );
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
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
      <div style={{ background: "var(--bg-base)" }} className="px-3 py-4">
        <div className="max-w-5xl w-full mx-auto">
          {uploadedFiles.length > 0 ? (
            <div
              style={{ background: "var(--bg-surface-ai)" }}
              className="flex flex-col gap-2 rounded-[30px] px-4 py-2"
            >
              <div className="flex gap-2">
                {uploadedFiles.map((file, index) => (
                  <FileCard
                    key={`${file.name}-${index}`}
                    file={file}
                    onRemove={(id) => handleRemoveFile(id)}
                  />
                ))}
              </div>
              <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhắn tin..."
                disabled={disabled}
                style={{ color: "var(--text-primary)" }}
                className="flex-1 bg-transparent text-sm placeholder:text-[var(--text-muted)]
                  resize-none outline-none max-h-40 leading-relaxed disabled:opacity-50"
              />
              <div className="flex items-center justify-between">
                <UploadButton
                  popoverOpen={popoverOpen}
                  onPopoverOpenChange={setPopoverOpen}
                  onFileSelect={() => fileInputRef.current?.click()}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleUpload}
                  style={{ display: "none" }}
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
                  style={
                    !value.trim() || disabled
                      ? { background: "var(--bg-surface-ai)", color: "var(--text-muted)" }
                      : { background: "var(--bg-surface-user)", color: "var(--text-primary)" }
                  }
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                />
              </div>
            </div>
          ) : (
            <div
              style={{ background: "var(--bg-surface-ai)" }}
              className="flex items-center justify-between rounded-[30px] px-4 py-2"
            >
              <UploadButton
                popoverOpen={popoverOpen}
                onPopoverOpenChange={setPopoverOpen}
                onFileSelect={() => fileInputRef.current?.click()}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUpload}
                style={{ display: "none" }}
              />
              <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhắn tin..."
                disabled={disabled}
                style={{ color: "var(--text-primary)" }}
                className="flex-1 bg-transparent text-sm placeholder:text-[var(--text-muted)]
                  resize-none outline-none max-h-40 leading-relaxed disabled:opacity-50"
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
                style={
                  !value.trim() || disabled
                    ? { background: "var(--bg-surface-ai)", color: "var(--text-muted)" }
                    : { background: "var(--bg-surface-user)", color: "var(--text-primary)" }
                }
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              />
            </div>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
}
