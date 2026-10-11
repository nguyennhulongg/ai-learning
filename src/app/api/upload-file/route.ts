import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { processAndIngestDocument } from '../../../../lib/ingest';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Không tìm thấy file tải lên' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Lưu tạm file vào thư mục temporary của hệ thống
        const tempFilePath = path.join(os.tmpdir(), file.name);
        await writeFile(tempFilePath, buffer);

        // Chạy pipeline nạp dữ liệu
        const result = await processAndIngestDocument(
            tempFilePath,
            file.name,
            file.type,
            `/uploads/${file.name}` // Hoặc URL lưu trữ thực tế trên Supabase Storage / S3
        );

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}