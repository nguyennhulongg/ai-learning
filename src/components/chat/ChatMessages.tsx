"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import MessageBubble from "./MessageBubble";
import ActivityIndicator, { getActivityLabel } from "./ActivityIndicator";

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  // Gọi khi người dùng sửa xong một tin của mình và bấm Send.
  onEdit: (messageId: string, text: string) => void;
  // Gọi khi bấm Thử lại trên một câu trả lời của AI.
  onRetry: (messageId: string) => void;
}

// Vẽ danh sách tin nhắn + dòng trạng thái (Thinking / tool đang chạy) ở cuối.
export default function ChatMessages({
  messages,
  isLoading,
  onEdit,
  onRetry,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // null = không hiện gì; ngược lại là nhãn đang hiển thị, ví dụ "Thinking".
  const activityLabel = getActivityLabel(messages, isLoading);
  const lastMessageId = messages[messages.length - 1]?.id;
  // Tin AI cuối cùng (không nhất thiết là tin cuối, ví dụ khi vừa gửi câu mới).
  const lastAssistantId = messages.findLast((m) => m.role === "assistant")?.id;

  // Cuộn xuống cuối khi có tin mới hoặc nhãn trạng thái đổi.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activityLabel]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-14">
      <div className="max-w-188 w-full mx-auto flex flex-col gap-5">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={
              isLoading &&
              message.role === "assistant" &&
              message.id === lastMessageId
            }
            onEdit={onEdit}
            onRetry={onRetry}
            canAct={!isLoading}
            isLastAssistant={message.id === lastAssistantId}
          />
        ))}
        {activityLabel && <ActivityIndicator label={activityLabel} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
