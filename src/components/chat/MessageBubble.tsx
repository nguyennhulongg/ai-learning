"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";
import ToolCallCard from "./ToolCallCard";
import CollapsibleText from "./CollapsibleText";

interface MessageBubbleProps {
  message: UIMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        style={
          isUser
            ? { background: "#715A5A", color: "#D3DAD9" }
            : { background: "#44444E", color: "#D3DAD9" }
        }
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
      >
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div
        style={
          isUser
            ? { background: "#715A5A", color: "#D3DAD9", fontSize: "17px" }
            : { background: "#44444E", color: "#D3DAD9", fontSize: "17px" }
        }
        className={`px-4 py-3 rounded-2xl leading-relaxed
          ${isUser ? "max-w-[90%] rounded-tr-sm" : "w-full rounded-tl-sm"}`}
      >
        {message.parts.map((part, i) => {
          // Text part
          if (part.type === "text") {
            if (!part.text) return null;
            return isUser ? (
              <CollapsibleText key={i} text={part.text} fadeColor="#715A5A" />
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
                        style={{ background: "#37353E" }}
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
                      style={{ background: "#37353E" }}
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
                    <thead style={{ background: "#37353E" }}>{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th
                      style={{ borderColor: "#715A5A" }}
                      className="border px-3 py-2 text-left font-semibold"
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      style={{ borderColor: "#4a4852" }}
                      className="border px-3 py-2"
                    >
                      {children}
                    </td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{ borderColor: "#715A5A", color: "#9aa3a2" }}
                      className="border-l-4 pl-3 italic my-2"
                    >
                      {children}
                    </blockquote>
                  ),
                  hr: () => (
                    <hr style={{ borderColor: "#4a4852" }} className="my-3" />
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

          // Tool invocation parts (tool-getWeather, tool-calculator, etc.)
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.replace(/^tool-/, "");
            const toolPart = part as unknown as {
              state: string;
              input: Record<string, unknown>;
              output?: unknown;
            };
            return (
              <ToolCallCard
                key={i}
                toolName={toolName}
                state={toolPart.state ?? "input-available"}
                input={toolPart.input ?? {}}
                output={toolPart.output as never}
              />
            );
          }

          return null;
        })}

        <p style={{ color: "#9aa3a2" }} className="text-xs mt-1.5">
          {new Date().toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
