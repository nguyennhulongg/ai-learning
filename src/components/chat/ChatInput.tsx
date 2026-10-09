"use client";

import { useRef, useState, useEffect } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
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

  return (
    <div style={{ background: "#2e2c35" }} className="px-4 py-4">
      <div className="max-w-5xl w-full mx-auto">
        <div
          style={{ background: "#37353E" }}
          className="flex items-end gap-2 rounded-2xl px-4 py-2"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhắn tin..."
            disabled={disabled}
            style={{ color: "#D3DAD9" }}
            className="flex-1 bg-transparent text-sm placeholder:text-[#4a4852]
              resize-none outline-none py-1.5 max-h-40 leading-relaxed disabled:opacity-50"
          />

          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            aria-label="Gửi tin nhắn"
            style={
              !value.trim() || disabled
                ? { background: "#44444E", color: "#9aa3a2" }
                : { background: "#715A5A", color: "#D3DAD9" }
            }
            className="mb-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0
              hover:brightness-110 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            <svg
              className="w-4 h-4 rotate-270"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
        <p style={{ color: "#9aa3a2" }} className="text-xs text-center mt-2">
          Nhấn Enter để gửi, Shift+Enter xuống dòng
        </p>
      </div>
    </div>
  );
}
