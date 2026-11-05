"use client";

import { useState } from "react";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import type { UIMessage } from "ai";
import { SlArrowDown, SlArrowUp } from "react-icons/sl";

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

function isSearchKnowledgePart(
  part: { type: string }
): part is SearchKnowledgeBasePart {
  return part.type === "tool-searchKnowledgeBase";
}

type MessageBubbleProps = {
  message: UIMessage;
  isStreaming?: boolean;
};

const MAX_LENGTH_FOR_PREVIEW = 200;

export default function MessageBubble({
  message,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [isExpanded, setIsExpanded] = useState(false);

  const textContent = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");

  const isLongMessage =
    isUser && textContent.length > MAX_LENGTH_FOR_PREVIEW;

  const shouldCollapse = isLongMessage && !isExpanded;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        style={
          isUser
            ? {
              background: "var(--bg-surface-user)",
              color: "var(--text-primary)",
              fontSize: "15px",
            }
            : {
              color: "var(--text-primary)",
              fontSize: "15px",
            }
        }
        className={`rounded-2xl leading-relaxed relative min-w-0 ${isUser ? "max-w-[60%] py-2 px-4" : "w-full px-1"
          }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (!part.text) return null;

            if (isUser) {
              return (
                <div key={i}>
                  <p className="whitespace-pre-wrap wrap-break-word overflow-hidden">
                    {shouldCollapse
                      ? part.text.slice(0, MAX_LENGTH_FOR_PREVIEW) + "..."
                      : part.text}
                  </p>

                  {isLongMessage && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded((prev) => !prev)}
                      aria-label={
                        isExpanded ? "Thu gọn tin nhắn" : "Mở rộng tin nhắn"
                      }
                      className="absolute bottom-3 right-3 w-8 h-5 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      style={{
                        color: "var(--text-primary)",
                        background: "var(--bg-surface-user)",
                        borderRadius: "6px",
                      }}
                    >
                      {isExpanded ? (
                        <SlArrowUp size={14} />
                      ) : (
                        <SlArrowDown size={14} />
                      )}
                    </button>
                  )}
                </div>
              );
            }

            return (
              <Streamdown
                className="message-markdown"
                plugins={{ code }}
                key={i}
                shikiTheme={["github-dark", "github-dark"]}
                isAnimating={isStreaming}
                components={{
                  a: ({ href, children, ...props }) => (
                    <a
                      {...props}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="my-2 overflow-hidden rounded-2xl border border-(--border) text-xs!">
                      <table className="w-full">
                        {children}
                      </table>
                    </div>
                  ),
                  tr: ({ children }) => (
                    <tr className="border-b border-(--border) text-xs!">
                      {children}
                    </tr>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-xs!">
                      {children}
                    </td>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-[13px]! text-start font-[550]">
                      {children}
                    </th>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-(--bg-sidebar)">
                      {children}
                    </thead>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-[20px] font-[550] mb-2">
                      {children}
                    </h3>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-[550]">
                      {children}
                    </strong>
                  )
                }}
              >
                {part.text}
              </Streamdown>
            );
          }

          if (
            part.type.startsWith("tool-") &&
            isSearchKnowledgePart(part)
          ) {
            return (
              <p
                key={i}
                className="whitespace-pre-wrap wrap-break-word overflow-hidden"
              >
                {part.output?.matchedContext || ""}
              </p>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
