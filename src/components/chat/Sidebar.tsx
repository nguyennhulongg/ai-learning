"use client";

import type { Conversation } from "@/types/chat";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        style={{ background: "#37353E" }}
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
          transition-transform duration-200
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2 px-4 shrink-0">
          <div
            style={{ background: "#715A5A" }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
          >
            <svg
              style={{ color: "#D3DAD9" }}
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"
              />
            </svg>
          </div>
          <span style={{ color: "#D3DAD9" }} className="font-semibold text-sm">
            AI Chat
          </span>
        </div>

        {/* New chat button */}
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={onNew}
            style={{ color: "#D3DAD9" }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
              hover:bg-white/5 transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Cuộc trò chuyện mới
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {conversations.length === 0 ? (
            <p
              style={{ color: "#9aa3a2" }}
              className="text-xs text-center mt-6 px-4"
            >
              Chưa có cuộc trò chuyện nào
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    onClick={() => onSelect(conv.id)}
                    style={
                      activeId === conv.id
                        ? { background: "#44444E", color: "#D3DAD9" }
                        : { color: "#9aa3a2" }
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors cursor-pointer
                      ${activeId === conv.id ? "font-medium" : "hover:bg-white/5"}`}
                  >
                    {conv.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 shrink-0">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <div
              style={{ background: "#715A5A", color: "#D3DAD9" }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            >
              U
            </div>
            <span style={{ color: "#D3DAD9" }} className="text-sm truncate">
              Người dùng
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
