"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation } from "@/types/chat";
import Sidebar from "./Sidebar";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import EmptyState from "./EmptyState";

const extractContent = (lastMessage: any) => {
  return lastMessage.parts
    .filter((p: any) => ['text', 'tool-searchKnowledgeBase'].includes(p.type))
    .map((p: any) => p.type === 'text' ? p.text : p.output.matchedContext)
    .join("");
}

export default function ChatLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastSavedMessageId = useRef<string | null>(null);

  const { messages, sendMessage, status, setMessages, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Helper function to save message to database
  const saveMessageToDatabase = useCallback(async (message: any) => {
    if (!activeId) return;

    const content = extractContent(message)

    try {
      await fetch(`/api/sessions/${activeId}/messages/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: message.role, content, parts: message.parts }),
      });
      lastSavedMessageId.current = message.id;
    } catch (err) {
      console.error(`Failed to save ${message.role} message:`, err);
    }
  }, [activeId]);

  // Save user message when sent (only on status change)
  useEffect(() => {
    if (status === "submitted" && activeId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user" && lastMessage.id !== lastSavedMessageId.current) {
        saveMessageToDatabase(lastMessage);
      }
    }
  }, [status, activeId, messages, saveMessageToDatabase]);

  // Save assistant message when streaming completes (only on status change)
  useEffect(() => {
    if (status === "ready" && activeId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant" && lastMessage.id !== lastSavedMessageId.current) {

        const content = extractContent(lastMessage)

        if (content && content.trim()) {
          saveMessageToDatabase(lastMessage);
        }
      }
    }
  }, [status, activeId, messages, saveMessageToDatabase]);

  // Save error message when error occurs
  useEffect(() => {
    if (status === "error" && activeId && error) {
      const errorMessage = typeof error.message === "string"
        ? error.message
        : JSON.stringify(error.message);

      if (errorMessage && errorMessage.trim()) {
        // Create a message object similar to assistant message
        const errorContent = errorMessage;
        const errorParts = [{ type: "text", text: errorContent }];

        // Save error message as assistant message
        fetch(`/api/sessions/${activeId}/messages/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: errorContent,
            parts: errorParts
          }),
        }).catch((err) => console.error("Failed to save error message:", err));
      }
    }
  }, [status, activeId, error]);

  // Load sessions from database on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const response = await fetch("/api/sessions/list");
        if (response.ok) {
          const sessions = await response.json();
          setConversations(
            sessions.map((s: any) => ({
              id: s.id,
              title: s.title,
              messages: [],
              createdAt: new Date(s.createdAt),
              isPinned: s.isPinned || false,
            }))
          );

          // Load session from URL if exists (only on initial mount)
          const sessionId = searchParams.get("session");
          if (sessionId && !activeId) {
            setActiveId(sessionId);
            loadMessages(sessionId);
          }
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []); // Only run on mount

  // Load messages when selecting a session
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/messages`);
      if (response.ok) {
        const messages = await response.json();
        // Convert database messages to UIMessage format
        const uiMessages = messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          parts: m.parts ? JSON.parse(m.parts) : [{ type: "text", text: m.content }],
        }));
        setMessages(uiMessages);
        // Track last loaded message ID to avoid duplicate saves
        if (uiMessages.length > 0) {
          lastSavedMessageId.current = uiMessages[uiMessages.length - 1].id;
        }
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [setMessages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveId(null);
    setSidebarOpen(false);
    clearError();
    router.push("/");
  }, [setMessages, clearError, router]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setMessages([]);
        setActiveId(null);
      }
    },
    [activeId, setMessages]
  );

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
  }, []);

  const handlePinSession = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c));
      // Sort: pinned first, then by date
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    });
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      setSidebarOpen(false);
      router.push(`?session=${id}`);
      loadMessages(id);
    },
    [loadMessages, router],
  );

  const handleSend = useCallback(
    async (text: string) => {
      // Clear any existing error before sending new message
      if (error) {
        clearError();
      }

      // Create new session if no active session
      if (!activeId) {
        try {
          const response = await fetch("/api/sessions/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: text.slice(0, 40) + (text.length > 40 ? "..." : ""),
            }),
          });

          if (response.ok) {
            const newSession = await response.json();
            setActiveId(newSession.id);
            setConversations((prev) => [
              {
                id: newSession.id,
                title: newSession.title,
                messages: [],
                createdAt: new Date(newSession.createdAt),
                isPinned: false,
              },
              ...prev,
            ]);
          }
        } catch (error) {
          console.error("Failed to create session:", error);
        }
      }

      sendMessage({ text });
    },
    [activeId, sendMessage, error, clearError],
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewChat}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
        onPin={handlePinSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {messages.length === 0 && !isLoading && !error ? (
          <EmptyState onSuggestion={handleSend} />
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            error={
              error
                ? (() => {
                  try {
                    return JSON.parse(error.message).error ?? error.message;
                  } catch {
                    return error.message;
                  }
                })()
                : undefined
            }
          />
        )}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
}
