"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { generateId } from "@/utils/id";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "antd";
import { LuPanelLeft } from "react-icons/lu";
import { useIsDesktop } from "@/hooks/useIsDesktop";
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

// Lấy câu báo lỗi dễ đọc từ Error của useChat.
// Khi route /api/chat trả 500, message là chuỗi JSON dạng {"error": "..."}; còn lại là chữ thường.
function parseErrorMessage(error: Error): string {
  try {
    return JSON.parse(error.message).error ?? error.message;
  } catch {
    return error.message;
  }
}

export default function ChatLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const [loading, setLoading] = useState(true);
  const lastSavedMessageId = useRef<string | null>(null);

  const { messages, sendMessage, regenerate, status, setMessages, error, clearError } = useChat({
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
        body: JSON.stringify({ id: message.id, role: message.role, content, parts: message.parts }),
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

  // Khi request lỗi (hết quota, mất mạng...): biến lỗi thành một tin assistant nằm hẳn trong
  // danh sách messages, thay vì chỉ giữ trong state `error` của useChat.
  // Lý do: state `error` bị xóa khi gửi câu tiếp theo → lỗi biến mất khỏi UI.
  // Part dùng loại "data-error" (không phải "text") để server không gửi nó cho model làm lịch sử.
  useEffect(() => {
    if (status !== "error" || !error) return;

    const text = parseErrorMessage(error);
    if (!text.trim()) return;

    const errorMessage: UIMessage = {
      id: generateId(),
      role: "assistant",
      parts: [{ type: "data-error", data: { message: text } }],
    };

    setMessages((prev) => [...prev, errorMessage]);
    // Lỗi đã nằm trong messages, xóa state error để nó không bị vẽ lần nữa.
    // Status về "ready"; effect lưu tin assistant ở trên sẽ bỏ qua tin này vì nó không có part text.
    clearError();

    if (activeId) {
      fetch(`/api/sessions/${activeId}/messages/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: errorMessage.id,
          role: "assistant",
          content: text,
          parts: errorMessage.parts,
        }),
      }).catch((err) => console.error("Failed to save error message:", err));
    }
  }, [status, activeId, error, setMessages, clearError]);

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

  // Sửa một tin nhắn của người dùng rồi hỏi lại AI.
  // 1. Xóa tin đó và mọi tin phía sau trong DB (câu trả lời cũ không còn đúng).
  // 2. sendMessage có messageId: useChat thay nội dung tin đó, cắt bỏ các tin phía sau
  //    trên giao diện, rồi gọi API lấy câu trả lời mới.
  // 3. Các useEffect lưu tin ở trên sẽ tự lưu lại tin đã sửa và câu trả lời mới vào DB.
  const handleEdit = useCallback(
    async (messageId: string, text: string) => {
      if (error) clearError();

      if (activeId) {
        try {
          await fetch(`/api/sessions/${activeId}/messages/${messageId}/truncate`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error("Failed to truncate messages:", err);
        }
      }

      // Tin sửa giữ nguyên id cũ. Reset để effect "lưu tin user" không bỏ qua nó
      // (nếu nó từng là tin cuối cùng được lưu).
      lastSavedMessageId.current = null;
      sendMessage({ text, messageId });
    },
    [activeId, sendMessage, error, clearError],
  );

  // Tạo lại một câu trả lời của AI.
  // 1. Xóa câu trả lời đó và mọi tin phía sau trong DB.
  // 2. regenerate(messageId): useChat bỏ tin AI đó cùng các tin sau nó trên giao diện,
  //    rồi gửi lại lịch sử (kết thúc bằng câu hỏi của người dùng) để lấy câu trả lời mới.
  // 3. Effect "lưu tin assistant khi stream xong" sẽ lưu câu trả lời mới vào DB.
  // Tin lỗi (data-error) cũng là tin assistant, nên Thử lại trên tin lỗi = hỏi lại câu vừa lỗi.
  const handleRetry = useCallback(
    async (messageId: string) => {
      if (error) clearError();

      if (activeId) {
        try {
          await fetch(`/api/sessions/${activeId}/messages/${messageId}/truncate`, {
            method: "DELETE",
          });
        } catch (err) {
          console.error("Failed to truncate messages:", err);
        }
      }

      regenerate({ messageId });
    },
    [activeId, regenerate, error, clearError],
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

      <div className="relative flex flex-col flex-1 min-w-0">
        {/* Mobile: thanh bên ẩn hẳn, nút này mở nó ra. Desktop đã có nút trên thanh bên nên không render.
            Dùng JS (isDesktop) thay cho class lg:hidden: CSS của antd nằm ngoài @layer nên luôn thắng
            class Tailwind, khiến lg:hidden không có tác dụng trên Button. */}
        {!isDesktop && !sidebarOpen && (
          <Button
            type="text"
            aria-label="Mở thanh bên"
            icon={<LuPanelLeft size={18} />}
            onClick={() => setSidebarOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 10 }}
            className="absolute! top-3 left-3 z-10"
          />
        )}
        {messages.length === 0 && !isLoading && !error ? (
          // Chưa có tin nhắn: lời chào + ô nhập nằm giữa màn hình như ChatGPT.
          // pb-[12vh] đẩy cả cụm lên cao hơn tâm một chút cho cân mắt.
          // Gửi câu đầu tiên → rơi vào nhánh dưới, ô nhập về lại đáy màn hình.
          <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-[12vh]">
            <EmptyState />
            <div className="w-full">
              <ChatInput onSend={handleSend} disabled={isLoading} />
            </div>
          </div>
        ) : (
          <>
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              onEdit={handleEdit}
              onRetry={handleRetry}
            />
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </>
        )}
      </div>
    </div>
  );
}
