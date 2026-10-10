"use client";

import { useLayoutEffect, useRef, useState } from "react";

const COLLAPSED_MAX_HEIGHT = 200;

interface CollapsibleTextProps {
  text: string;
  fadeColor: string;
}

export default function CollapsibleText({ text, fadeColor }: CollapsibleTextProps) {
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () =>
      setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const isCollapsed = isOverflowing && !isExpanded;

  return (
    <div>
      <div className="relative">
        <p
          ref={contentRef}
          className="whitespace-pre-wrap break-words overflow-hidden"
          style={isCollapsed ? { maxHeight: COLLAPSED_MAX_HEIGHT } : undefined}
        >
          {text}
        </p>
        {isCollapsed && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: `linear-gradient(to bottom, transparent, ${fadeColor})`,
            }}
          />
        )}
      </div>
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Thu gọn tin nhắn" : "Mở rộng tin nhắn"}
          title={isExpanded ? "Thu gọn" : "Xem thêm"}
          className="mt-1 flex items-center gap-1 text-sm opacity-80 hover:opacity-100 cursor-pointer"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}
