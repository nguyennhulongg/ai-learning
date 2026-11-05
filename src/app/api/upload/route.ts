
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/db';
import { files } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_PURPOSE } from '@/constants/files';
import { UploadResponse } from '@/features/upload/upload.types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  const fileId = uuidv4();

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    const rawPurpose = formData.get("purpose");

    if (
      typeof rawPurpose !== "string" ||
      !Object.values(UPLOAD_PURPOSE).includes(
        rawPurpose as (typeof UPLOAD_PURPOSE)[keyof typeof UPLOAD_PURPOSE],
      )
    ) {
      return NextResponse.json(
        { error: "purpose không hợp lệ" },
        { status: 400 },
      );
    }

    const purpose = rawPurpose;

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'File không hợp lệ hoặc đang trống' },
        { status: 400 },
      );
    }

    // Ví dụ giới hạn 20 MB; điều chỉnh theo nhu cầu.
    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File vượt quá giới hạn 20 MB' },
        { status: 413 },
      );
    }

    if (rawPurpose === UPLOAD_PURPOSE.KNOWLEDGE_BASE && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Tài liệu phải là file PDF' },
        { status: 400 },
      );
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error: uploadError } = await supabase.storage
      .from('files-upload')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);

      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }

    try {
      await db.insert(files).values({
        id: fileId,
        file_name: file.name,
        storage_path: data.path,
        bucket_name: "files-upload",
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        status: "uploaded",
        purpose,
        processing_status:
          purpose === UPLOAD_PURPOSE.KNOWLEDGE_BASE
            ? "pending"
            : "not_required",
      });
    } catch (dbError) {
      const { error: deleteError } = await supabase.storage
        .from('files-upload')
        .remove([data.path]);

      if (deleteError) {
        console.error('Storage cleanup error:', deleteError);
      }

      throw dbError;
    }

    const { data: signedData, error: signedError } =
      await supabase.storage
        .from('files-upload')
        .createSignedUrl(data.path, 3600);

    if (signedError) {
      console.error('Create signed URL error:', signedError);
    }

    return NextResponse.json<UploadResponse>({
      fileId,
      purpose,
      path: data.path,
      signedUrl: signedData?.signedUrl ?? null,
      name: file.name,
      size: file.size,
      type: file.type,
    });

  } catch (error: unknown) {
    console.error('Upload error:', error);

    const message =
      error instanceof Error ? error.message : 'Upload thất bại';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
