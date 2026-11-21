import { NextResponse } from "next/server";

import { cancelDocument } from "@/server/documents";

// Huỷ việc xử lý một tài liệu đang chạy.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    await cancelDocument(fileId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling document:", error);
    return NextResponse.json({ error: "Không huỷ được file." }, { status: 500 });
  }
}
