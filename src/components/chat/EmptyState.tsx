const SUGGESTIONS = [
  "Giải thích khái niệm React Server Components",
  "Viết một hàm debounce bằng TypeScript",
  "So sánh SQL vs NoSQL database",
  "Cách tối ưu hiệu năng Next.js app",
];

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

export default function EmptyState({ onSuggestion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 gap-8">
      <div className="text-center">
        <div
          style={{ background: "#715A5A" }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        >
          <svg
            style={{ color: "#D3DAD9" }}
            className="w-9 h-9"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"
            />
          </svg>
        </div>
        <h1 style={{ color: "#D3DAD9" }} className="text-2xl font-bold">
          Bắt đầu trò chuyện
        </h1>
        <p style={{ color: "#9aa3a2" }} className="mt-1 text-sm">
          Hỏi bất kỳ điều gì bạn muốn
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            style={{
              background: "#44444E",
              borderColor: "#4a4852",
              color: "#D3DAD9",
            }}
            className="text-left px-4 py-3 rounded-xl border text-sm cursor-pointer
              hover:border-[#715A5A] hover:brightness-110 transition-all duration-150"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
