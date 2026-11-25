// Lời chào hiện phía trên ô nhập khi cuộc trò chuyện còn trống (giống màn hình đầu của ChatGPT).
// Ô nhập do ChatLayout đặt ngay bên dưới, cả cụm được canh giữa màn hình.
export default function EmptyState() {
  return (
    <h1
      style={{ color: "var(--text-primary)" }}
      className="px-4 text-center text-[28px] font-medium"
    >
      Bắt đầu trò chuyện
    </h1>
  );
}
