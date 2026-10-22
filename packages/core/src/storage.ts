/**
 * Object storage on Neon (S3-compatible API).
 *
 * Buckets are private; every read goes through a short-lived presigned URL or
 * the `/api/files` proxy route.
 */
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";

import { BUCKETS, type BucketName } from "./files";

export { BUCKETS, filePath, type BucketName } from "./files";

const globalForS3 = globalThis as unknown as { lekhS3?: S3Client };

function client(): S3Client {
  if (globalForS3.lekhS3) return globalForS3.lekhS3;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-2";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
    );
  }
  const s3 = new S3Client({
    endpoint,
    region,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: { accessKeyId, secretAccessKey },
  });
  if (process.env.NODE_ENV !== "production") globalForS3.lekhS3 = s3;
  return s3;
}

export function storageConfigured(): boolean {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function objectKey(prefix: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}/${Date.now().toString(36)}-${rand}-${safe}`;
}

export async function createUploadUrl(
  bucket: BucketName,
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<{ url: string; key: string }> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(client(), command, { expiresIn });
  return { url, key };
}

export async function createDownloadUrl(
  bucket: BucketName,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client(), command, { expiresIn });
}

export async function removeObject(bucket: BucketName, key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

