import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { storeFileInMemory } from '@/lib/uploadCache';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('file') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const tmpUploadDir = path.join('/tmp', 'uploads');

    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch {
      // Ignore
    }

    try {
      if (!fs.existsSync(tmpUploadDir)) {
        fs.mkdirSync(tmpUploadDir, { recursive: true });
      }
    } catch {
      // Ignore
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // Basic validation
      if (!file.type.startsWith('image/')) {
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Sanitize extension
      const ext = path.extname(file.name) || '.jpg';
      const safeFilename = `${nanoid(10)}${ext.toLowerCase()}`;
      const mimeType = file.type || 'image/jpeg';

      // 1. Cache immediately in memory
      storeFileInMemory(safeFilename, buffer, mimeType);

      // 2. Persist to public/uploads if writable
      try {
        fs.writeFileSync(path.join(uploadDir, safeFilename), buffer);
      } catch {
        // Fallback to /tmp
        try {
          fs.writeFileSync(path.join(tmpUploadDir, safeFilename), buffer);
        } catch {
          // Ignore
        }
      }

      // Always return dynamic API URL which serves the file from memory or disk
      uploadedUrls.push(`/api/uploads/${safeFilename}`);
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
      url: uploadedUrls[0] || null,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to process file upload' }, { status: 500 });
  }
}
