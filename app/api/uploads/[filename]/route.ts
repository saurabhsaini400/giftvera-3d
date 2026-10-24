import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getFileFromMemory, storeFileInMemory } from '@/lib/uploadCache';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  if (!filename) {
    return new NextResponse('Filename missing', { status: 400 });
  }

  // 1. Check memory cache first
  const cached = getFileFromMemory(filename);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        'Content-Type': cached.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  // 2. Check disk locations
  const potentialPaths = [
    path.join(process.cwd(), 'public', 'uploads', filename),
    path.join('/tmp', 'uploads', filename),
    path.join(process.cwd(), 'uploads', filename),
  ];

  for (const filePath of potentialPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const mimeType =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';

        // Cache in memory for subsequent requests
        storeFileInMemory(filename, buffer, mimeType);

        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch {
      // Continue searching
    }
  }

  return new NextResponse('Image not found', { status: 404 });
}
