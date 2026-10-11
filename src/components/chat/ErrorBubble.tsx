interface ErrorBubbleProps {
  message: string;
}

export default function ErrorBubble({ message }: ErrorBubbleProps) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        style={{ background: "#715A5A", color: "#D3DAD9" }}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
      >
        !
      </div>

      {/* Bubble */}
      <div
        style={{
          background: "#4a2e2e",
          borderColor: "#715A5A",
          color: "#D3DAD9",
          fontSize: "15px",
        }}
        className="px-4 py-3 rounded-2xl rounded-tl-sm border flex flex-col gap-2 max-w-[85%]"
      >
        <div className="flex items-start gap-2">
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}
