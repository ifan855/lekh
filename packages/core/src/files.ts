/**
 * Client-safe helpers for object storage paths.
 *
 * Keep this module dependency-free: it is imported by client components and
 * must never pull the database or the AWS SDK into the browser bundle.
 */
export const BUCKETS = {
  covers: "covers",
  thumbnails: "thumbnails",
  avatars: "avatars",
  uploads: "uploads",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** URL that always works in the browser (proxied through our API route). */
export function filePath(bucket: BucketName, key: string | null | undefined): string | null {
  if (!key) return null;
  return `/api/files/${bucket}/${encodeURIComponent(key)}`;
}
