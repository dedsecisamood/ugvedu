/**
 * Cursor pagination helpers. Cursors encode (createdAt ISO, id) as base64
 * so callers cannot forge or introspect them. Envelope: { data, nextCursor, total }.
 */
import { z } from "zod";

export interface PageEnvelope<T = unknown> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

/** Row shape returned by list endpoints — loose to satisfy TSS serializer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiRow = any;

export interface DecodedCursor {
  createdAt: string;
  id: string;
}

export const cursorSchema = z.string().max(512).optional();

export function encodeCursor(row: { created_at: string; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id })).toString("base64url");
}

export function decodeCursor(cursor: string | undefined | null): DecodedCursor | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" && parsed !== null
      && "createdAt" in parsed && "id" in parsed
      && typeof (parsed as DecodedCursor).createdAt === "string"
      && typeof (parsed as DecodedCursor).id === "string"
    ) {
      // Reject anything that isn't a plausible ISO date / uuid-ish id
      const c = parsed as DecodedCursor;
      if (Number.isNaN(Date.parse(c.createdAt))) return null;
      return c;
    }
    return null;
  } catch {
    return null;
  }
}

export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);
