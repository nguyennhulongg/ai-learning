interface ChatHeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

export default function ChatHeader({
  title,
  onToggleSidebar,
}: ChatHeaderProps) {
  return (
    <header
      style={{ background: "#37353E", borderColor: "#4a4852" }}
      className="h-14 border-b flex items-center px-4 gap-3 shrink-0"
    >
      <button
        onClick={onToggleSidebar}
        aria-label="Mở sidebar"
        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
      >
        <svg
          style={{ color: "#9aa3a2" }}
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <h2
        style={{ color: "#D3DAD9" }}
        className="flex-1 text-sm font-medium truncate"
      >
        {title}
      </h2>

      <div
        style={{ background: "#44444E", color: "#9aa3a2" }}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
      >
        <span
          style={{ background: "#D3DAD9" }}
          className="w-1.5 h-1.5 rounded-full"
        />
        AI Assistant
      </div>
    </header>
  );
}
