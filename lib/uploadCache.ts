// Shared memory cache for uploaded image files across API routes
const FILE_MEMORY_CACHE = new Map<string, { buffer: Buffer; mimeType: string }>();

export function storeFileInMemory(filename: string, buffer: Buffer, mimeType: string): void {
  FILE_MEMORY_CACHE.set(filename, { buffer, mimeType });
}

export function getFileFromMemory(filename: string): { buffer: Buffer; mimeType: string } | null {
  return FILE_MEMORY_CACHE.get(filename) || null;
}
