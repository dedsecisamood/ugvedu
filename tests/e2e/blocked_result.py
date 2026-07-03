"""
E2E: BLOCKED result warning banner.

Logs in as the seeded student with a BLOCKED semester (12521076), lands on
/results, and asserts that the non-alarming-but-visible banner directing them
to the department head is rendered.

Prereqs (this is a live-DB E2E, not a hermetic test):
  - Dev server running at http://localhost:8080
  - LOVABLE_BROWSER_AUTH_STATUS=injected with a session for student 12521076
    (sign in through the preview once, then re-run)
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright, expect

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")


async def restore_session(context, page):
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
    if status != "injected":
        print(f"SKIP: LOVABLE_BROWSER_AUTH_STATUS={status!r}; sign in via the preview first.")
        sys.exit(77)  # 77 = skipped (autotools convention)

    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)

    await page.goto(BASE_URL, wait_until="domcontentloaded")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        await restore_session(context, page)
        await page.goto(f"{BASE_URL}/results", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "blocked_results.png"))

        # The warning banner text is asserted verbatim against the wording the
        # engine uses in gpa-engine.ts (`isSemesterBlocked` reason). If a future
        # refactor changes the wording, this test fails and the change is caught.
        banner = page.get_by_text("Please immediate contact to Department Head", exact=False)
        await expect(banner).to_be_visible(timeout=10_000)

        # Banner must sit near the top of the page (not buried at the bottom).
        box = await banner.bounding_box()
        assert box is not None and box["y"] < 800, f"banner too far down the page: y={box}"

        print("PASS: blocked-result banner is visible and above the fold")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
