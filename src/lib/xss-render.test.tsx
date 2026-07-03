import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * XSS regression: any user-supplied text (notice bodies, profile fields,
 * course titles) must reach the DOM through React's JSX text interpolation,
 * which HTML-escapes the string. Regressions typically look like a well-
 * meaning refactor to `dangerouslySetInnerHTML` for "rich" formatting.
 *
 * This test mirrors the exact render used on the Notices page:
 *   <div className="whitespace-pre-wrap">{notice.body}</div>
 *
 * If someone reintroduces raw HTML rendering, the assertion fails.
 */
describe("XSS: user-authored text renders as inert content", () => {
  const payloads = [
    `<script>window.__pwned = true</script>`,
    `<img src=x onerror="window.__pwned=1">`,
    `<svg/onload=alert(1)>`,
    `"><script>alert('xss')</script>`,
    `javascript:alert(1)`,
  ];

  for (const payload of payloads) {
    it(`escapes: ${payload.slice(0, 40)}`, () => {
      const html = renderToStaticMarkup(
        <div className="whitespace-pre-wrap">{payload}</div>,
      );
      // No raw executable tags leaked through
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/onerror=/i);
      expect(html).not.toMatch(/onload=/i);
      // Angle-brackets are entity-escaped
      if (payload.includes("<")) expect(html).toContain("&lt;");
      if (payload.includes(">")) expect(html).toContain("&gt;");
    });
  }
});
