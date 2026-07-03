/**
 * Storage abstraction. Route/server-fn code depends on this interface, NOT on
 * the Supabase client directly, so we can swap the backing store (Supabase
 * Storage, S3, local disk) without touching business logic.
 *
 * The concrete implementation is picked in `getStorage()`; today it uses
 * Supabase Storage (which is S3-compatible), authenticated with the caller's
 * bearer token so RLS on `storage.objects` applies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface SignedUploadTarget {
  /** URL the client PUTs the file to. */
  uploadUrl: string;
  /** Opaque token some SDKs require alongside the URL. */
  token: string;
  /** Absolute path inside the bucket that the row must record. */
  storagePath: string;
  /** Bucket name (echoed for convenience). */
  bucket: string;
}

export interface SignedDownload {
  url: string;
  expiresInSec: number;
}

export interface StorageDriver {
  createUploadUrl(input: { bucket: string; path: string }): Promise<SignedUploadTarget>;
  createDownloadUrl(input: { bucket: string; path: string; expiresInSec?: number }): Promise<SignedDownload>;
  remove(input: { bucket: string; path: string }): Promise<void>;
}

class SupabaseStorageDriver implements StorageDriver {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createUploadUrl({ bucket, path }: { bucket: string; path: string }): Promise<SignedUploadTarget> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      storagePath: path,
      bucket,
    };
  }

  async createDownloadUrl({ bucket, path, expiresInSec = 300 }: { bucket: string; path: string; expiresInSec?: number }): Promise<SignedDownload> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(path, expiresInSec);
    if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown"}`);
    return { url: data.signedUrl, expiresInSec };
  }

  async remove({ bucket, path }: { bucket: string; path: string }): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) throw new Error(`Failed to remove object: ${error.message}`);
  }
}

/** Factory. Today returns Supabase-backed; swap here for S3/local in the future. */
export function getStorage(client: SupabaseClient<Database>): StorageDriver {
  return new SupabaseStorageDriver(client);
}

/** MIME/size allow-list for course materials & lab submissions. */
export const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
]);

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export function assertUploadAllowed(mime: string, sizeBytes: number): void {
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error(`Unsupported file type: ${mime}`);
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File size out of range (max ${MAX_UPLOAD_BYTES} bytes)`);
  }
}
