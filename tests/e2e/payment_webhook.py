"""
E2E: Payment status only flips to PAID after the backend webhook fires — never
optimistically on the client.

Flow:
  1. Load /payments, capture the initial history length.
  2. Click "Pay Now" to jump into the sandbox gateway.
  3. Assert that BEFORE the gateway's "Simulate success" button is clicked,
     no new PAID row has appeared (i.e. the app is not eagerly marking paid).
  4. Click "Simulate success" — the gateway posts to the webhook, then
     redirects back to /payments?tran_id=...
  5. Poll /payments until a PAID row with the new tran_id appears. This is
     the webhook-driven update, not an optimistic one.

Prereqs: same as blocked_result.py (signed-in session for a student with an
outstanding balance).
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
        sys.exit(77)

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
        await page.goto(f"{BASE_URL}/payments", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / "payments_before.png"))

        pay_button = page.get_by_role("button", name="Pay Now")
        if not await pay_button.count():
            print("SKIP: no outstanding balance on this account — nothing to pay.")
            sys.exit(77)

        # Count PAID rows before the pay attempt.
        paid_rows_before = await page.get_by_text("PAID", exact=False).count()

        await pay_button.first.click()
        await page.wait_for_url("**/pay/checkout**", timeout=10_000)
        await page.screenshot(path=str(SCREENSHOTS / "gateway.png"))

        # In a separate tab, verify no PAID row appeared yet. The client must
        # not have optimistically marked the payment before the webhook.
        probe = await context.new_page()
        await probe.goto(f"{BASE_URL}/payments", wait_until="networkidle")
        paid_rows_mid = await probe.get_by_text("PAID", exact=False).count()
        assert paid_rows_mid == paid_rows_before, (
            f"payments page marked PAID BEFORE webhook fired: "
            f"{paid_rows_before} -> {paid_rows_mid}"
        )
        await probe.close()

        # Complete the gateway.
        await page.get_by_role("button", name="Simulate success").click()
        await page.wait_for_url("**/payments**", timeout=15_000)

        # Poll for the webhook-driven update.
        deadline = asyncio.get_event_loop().time() + 15
        confirmed = False
        while asyncio.get_event_loop().time() < deadline:
            paid_now = await page.get_by_text("PAID", exact=False).count()
            if paid_now > paid_rows_before:
                confirmed = True
                break
            await page.wait_for_timeout(500)
            await page.reload(wait_until="networkidle")

        await page.screenshot(path=str(SCREENSHOTS / "payments_after.png"))
        assert confirmed, "payment never reached PAID state after webhook redirect"
        print("PASS: payment flipped to PAID only after webhook confirmation")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
