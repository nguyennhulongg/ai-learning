import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

// Xóa tin nhắn messageId và mọi tin nhắn sau nó trong cùng phiên.
// Dùng khi người dùng sửa một tin đã gửi: các câu trả lời cũ không còn đúng nữa,
// client sẽ lưu lại tin đã sửa và câu trả lời mới như một lượt chat bình thường.
// "Sau nó" = created_at lớn hơn hoặc bằng, vì tin nhắn được lưu tuần tự theo thời gian.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params;

    const [target] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.sessionId, id), eq(messages.id, messageId)));

    if (!target) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await db
      .delete(messages)
      .where(and(eq(messages.sessionId, id), gte(messages.createdAt, target.createdAt)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error truncating messages:", error);
    return NextResponse.json(
      { error: "Failed to truncate messages" },
      { status: 500 }
    );
  }
}
