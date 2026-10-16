"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";
import { SlArrowDown } from "react-icons/sl";
import { SlArrowUp } from "react-icons/sl";

export type SearchKnowledgeBasePart = {
  type: "tool-searchKnowledgeBase";
  toolCallId: string;
  state: "call" | "result" | "output-available" | "partial-call";
  input: {
    query: string;
  };
  output?: {
    matchedContext: string;
  };
};

// 2. Viết Type Guard để phân loại tường minh
function isSearchKnowledgePart(part: any): part is SearchKnowledgeBasePart {
  return part.type === "tool-searchKnowledgeBase";
}

type MessageBubbleProps = {
  message: UIMessage
};

const MAX_LENGTH_FOR_PREVIEW = 200;

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [isExpanded, setIsExpanded] = useState(false);

  // Get text content from message parts
  const textContent = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("");

  const isLongMessage = isUser && textContent.length > MAX_LENGTH_FOR_PREVIEW;
  const shouldCollapse = isLongMessage && !isExpanded;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        style={
          isUser
            ? { background: "var(--bg-surface-user)", color: "var(--text-primary)" }
            : { background: "var(--bg-surface-ai)", color: "var(--text-primary)" }
        }
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div
        style={
          isUser
            ? { background: "var(--bg-surface-user)", color: "var(--text-primary)", fontSize: "17px" }
            : { color: "var(--text-primary)", fontSize: "17px" }
        }
        className={`rounded-2xl leading-relaxed relative
          ${isUser ? "max-w-[60%] rounded-tr-sm py-3 px-4" : "w-full rounded-tl-sm px-1"}`}
      >
        {message.parts.map((part, i) => {
          // Text part
          if (part.type === "text") {
            if (!part.text) return null;
            return isUser ? (
              <div key={i}>
                <p className="whitespace-pre-wrap break-words overflow-hidden">
                  {shouldCollapse
                    ? part.text.slice(0, MAX_LENGTH_FOR_PREVIEW) + "..."
                    : part.text}
                </p>
                {isLongMessage && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute bottom-3 right-3 w-8 h-5 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                    style={{
                      color: "var(--text-primary)",
                      background: "var(--bg-surface-user)",
                      borderRadius: "6px"
                    }}
                  >
                    {isExpanded ? <SlArrowUp size={14} /> : <SlArrowDown size={14} />}
                  </button>
                )}
              </div>
            ) : (
              <ReactMarkdown
                key={i}
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold mb-1 mt-2">
                      {children}
                    </h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 mb-2 space-y-1">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 mb-2 space-y-1">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  code: ({
                    inline,
                    children,
                    ...props
                  }: {
                    inline?: boolean;
                    children?: React.ReactNode;
                  }) =>
                    inline ? (
                      <code
                        style={{ background: "var(--bg-surface-ai)" }}
                        className="px-1.5 py-0.5 rounded text-[15px] font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code className="block" {...props}>
                        {children}
                      </code>
                    ),
                  pre: ({ children }) => (
                    <pre
                      style={{ background: "var(--bg-surface-ai)" }}
                      className="p-3 rounded-lg overflow-x-auto text-[15px] font-mono mb-2"
                    >
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-2">
                      <table className="w-full border-collapse text-[16px]">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={{ background: "var(--bg-surface-ai)" }}>{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th
                      style={{ borderColor: "var(--bg-surface-user)" }}
                      className="border px-3 py-2 text-left font-semibold"
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      style={{ borderColor: "var(--border)" }}
                      className="border px-3 py-2"
                    >
                      {children}
                    </td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{ borderColor: "var(--bg-surface-user)", color: "var(--text-muted)" }}
                      className="border-l-4 pl-3 italic my-2"
                    >
                      {children}
                    </blockquote>
                  ),
                  hr: () => (
                    <hr style={{ borderColor: "var(--border)" }} className="my-3" />
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#D3DAD9" }}
                      className="underline underline-offset-2 opacity-80 hover:opacity-100"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {part.text}
              </ReactMarkdown>
            );
          }

          // Tool invocation parts - không render UI card
          if (part.type.startsWith("tool-") && isSearchKnowledgePart(part)) {
            return (
              <p key={i} className="whitespace-pre-wrap break-words overflow-hidden">
                {part.output?.matchedContext || ""}
              </p>
            );
          }

          return null;
        })}

        <p style={{ color: "var(--text-muted)" }} className="text-xs mt-1.5">
          {new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
