import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@/utils/id";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { role, content, parts, id: clientId } = body;

    // Dùng lại id mà useChat đã tạo ở client (nếu hợp lệ) để id trong DB khớp id trên giao diện.
    // Nhờ vậy khi người dùng sửa một tin nhắn, server biết chính xác phải cắt từ dòng nào.
    const messageId =
      typeof clientId === "string" && clientId.length > 0 && clientId.length <= 36
        ? clientId
        : generateId();

    if (!role || !content) {
      return NextResponse.json(
        { error: "Role and content are required" },
        { status: 400 }
      );
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        id: messageId,
        sessionId: id,
        role,
        content,
        parts: parts ? JSON.stringify(parts) : JSON.stringify([{ type: "text", text: content }])
      })
      .returning();

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
