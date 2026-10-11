"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import MessageBubble from "./MessageBubble";

import ErrorBubble from "./ErrorBubble";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  error?: string;
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div
        style={{ background: "#44444E", color: "#D3DAD9" }}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
      >
        AI
      </div>
      <div
        style={{ background: "#44444E" }}
        className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ background: "#D3DAD9", animationDelay: `${i * 0.15}s` }}
            className="w-2 h-2 rounded-full animate-bounce"
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatMessages({
  messages,
  isLoading,
  error,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        {error && <ErrorBubble message={error} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
