"use client";

import { useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { Conversation } from "@/types/chat";
import Sidebar from "./Sidebar";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import EmptyState from "./EmptyState";

let _counter = 0;
function generateId() {
  return `id-${++_counter}-${Date.now()}`;
}

export default function ChatLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveId(null);
    setSidebarOpen(false);
  }, [setMessages]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;
      setMessages(conv.messages);
      setActiveId(id);
      setSidebarOpen(false);
    },
    [conversations, setMessages],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (messages.length === 0) {
        const newId = generateId();
        setActiveId(newId);
        setConversations((prev) => [
          {
            id: newId,
            title: text.slice(0, 40) + (text.length > 40 ? "..." : ""),
            messages: [],
            createdAt: new Date(),
          },
          ...prev,
        ]);
      }
      sendMessage({ text });
    },
    [messages.length, sendMessage],
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#2e2c35" }}
    >
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {messages.length === 0 && !isLoading ? (
          <EmptyState onSuggestion={handleSend} />
        ) : (
          <ChatMessages messages={messages} isLoading={isLoading} />
        )}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
