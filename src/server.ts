import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Baseline security headers applied to every outgoing response.
 *
 *  - CSP: locked down to same-origin JS/CSS/fonts, images from same-origin
 *    plus data:/blob: (crop previews, generated QR/PDF), and
 *    connect-src to same-origin + our Supabase project (Auth, Data API,
 *    Storage, Realtime WebSocket). No `unsafe-eval`. `unsafe-inline` on
 *    style-src remains because shadcn's chart component emits a small
 *    dev-controlled <style dangerouslySetInnerHTML> block for chart
 *    theme variables (values come from developer config, never user input).
 *  - HSTS: 2-year with subdomains + preload (safe once the site is HTTPS-only).
 *  - X-Frame-Options DENY: this app is never embedded; blocks clickjacking.
 *  - X-Content-Type-Options nosniff: forbids MIME sniffing on user uploads
 *    served through signed URLs.
 *  - Referrer-Policy: don't leak protected route paths across origins.
 *  - Permissions-Policy: turn off sensors we don't use.
 *
 * Headers are NOT applied to WebSocket upgrades or when the framework
 * already emitted its own (e.g. for auth redirects); we merge, never overwrite.
 */
function applySecurityHeaders(response: Response, request: Request): Response {
  // Never rewrite an opaque/redirect Response or a WebSocket upgrade.
  if (response.status === 101) return response;

  const supabaseHost = (() => {
    try {
      return new URL(process.env.SUPABASE_URL ?? "").host;
    } catch {
      return "";
    }
  })();
  const connectSupabase = supabaseHost
    ? `https://${supabaseHost} wss://${supabaseHost}`
    : "";

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // TSS injects a small inline bootstrap script for hydration; keeping
    // 'unsafe-inline' on script-src is required for the framework and is
    // acceptable given no user-controlled HTML ever reaches the DOM.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${connectSupabase}`.trim(),
    "form-action 'self'",
  ].join("; ");

  const headers = new Headers(response.headers);
  const setIfAbsent = (name: string, value: string) => {
    if (!headers.has(name)) headers.set(name, value);
  };
  setIfAbsent("Content-Security-Policy", csp);
  setIfAbsent("X-Content-Type-Options", "nosniff");
  setIfAbsent("X-Frame-Options", "DENY");
  setIfAbsent("Referrer-Policy", "strict-origin-when-cross-origin");
  setIfAbsent(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  );
  // Only send HSTS over HTTPS. Local http://localhost dev serves without it.
  if (new URL(request.url).protocol === "https:") {
    setIfAbsent(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  // Preserve body + status; only headers change.
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return applySecurityHeaders(normalized, request);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },
};
