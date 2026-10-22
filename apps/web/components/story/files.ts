/**
 * Client-safe mirror of `@lekh/core`'s `filePath`.
 *
 * The core helper lives in a module that also imports the S3 SDK, so it cannot
 * be pulled into a browser bundle. The URL format is identical:
 *   /api/files/<bucket>/<key>
 */
export const FILE_BUCKETS = ["covers", "thumbnails", "avatars", "uploads"] as const;
export type FileBucket = (typeof FILE_BUCKETS)[number];

export function fileUrl(bucket: FileBucket, key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/files/${bucket}/${encodeURIComponent(key)}`;
}

export function coverUrl(key: string | null | undefined): string | null {
  return fileUrl("covers", key);
}

export function thumbnailUrl(key: string | null | undefined): string | null {
  return fileUrl("thumbnails", key);
}

export function avatarUrl(key: string | null | undefined): string | null {
  return fileUrl("avatars", key);
}
