/**
 * Shared helper for /api/* HTTP routes. Server functions handle app-internal
 * calls; these thin routes exist so external REST callers (mobile, integrations,
 * curl-based verification) can hit the same logic with a bearer token.
 *
 * Auth model: `Authorization: Bearer <supabase-jwt>` header is required.
 * We create an RLS-scoped Supabase client with that token and hand it to the
 * handler alongside the resolved userId. Anything the handler does through
 * `supabase` is subject to the caller's RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ApiContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

function isNewApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function makeFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewApiKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Verify the bearer token, return an RLS-scoped Supabase client + userId.
 * Returns a 401 Response on failure — caller should return it directly.
 */
export async function authenticate(request: Request): Promise<ApiContext | Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return jsonError(500, "Server misconfigured");

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonError(401, "Missing bearer token");
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return jsonError(401, "Invalid token");

  const supabase = createClient<Database>(url, key, {
    global: { fetch: makeFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return jsonError(401, "Invalid token");
    return { supabase, userId: data.claims.sub as string };
  } catch {
    return jsonError(401, "Invalid token");
  }
}

/** Safely parse a JSON body; returns undefined on empty. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { throw new Response("Invalid JSON body", { status: 400 }); }
}
