import { Button } from "antd";

interface SidebarHeaderProps {
  onNewChat: () => void;
}

export default function SidebarHeader({ onNewChat }: SidebarHeaderProps) {
  return (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-4 shrink-0">
        <div
          style={{ background: "var(--bg-surface-user)" }}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
        >
          <svg
            style={{ color: "var(--text-primary)" }}
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
        <span style={{ color: "var(--text-primary)" }} className="font-semibold text-sm">
          AI Chat
        </span>
      </div>

      {/* New chat button */}
      <div className="px-3 pb-3 shrink-0">
        <Button
          onClick={onNewChat}
          type="text"
          style={{ color: "var(--text-primary)", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "8px" }}
          className="hover:bg-white/5"
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
        </Button>
      </div>
    </>
  );
}
