import { NextResponse } from "next/server";

import { deleteDocument } from "@/server/documents";

// Xoá một tài liệu cùng toàn bộ dữ liệu sinh ra từ nó.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params;
    const deleted = await deleteDocument(fileId);

    if (!deleted) {
      return NextResponse.json({ error: "Không tìm thấy file." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Không xoá được file." }, { status: 500 });
  }
}
