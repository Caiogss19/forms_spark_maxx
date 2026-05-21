import { expect, test } from "@playwright/test";

/**
 * Framer (and other SPA hosts) often call `history.replaceState` shortly
 * after the page settles, stripping `?utm_*` from the URL. embed.js must
 * survive this:
 *
 *  - It snapshots `location.href` at script-load time (handles the in-
 *    session case).
 *  - It mirrors UTMs into `localStorage` so a returning visitor (or a
 *    deeper navigation that lost the querystring) still gets attribution.
 */
test.describe("UTMs survive history.replaceState (SPA hosts)", () => {
  test("persists UTMs to localStorage and rehydrates on a clean URL", async ({
    page,
  }) => {
    // First visit lands with UTMs — embed.js should persist them.
    await page.goto(
      "/embed-demo.html?utm_source=framer_test&utm_medium=sponsored&gclid=g_first",
    );
    await expect(page.locator("iframe[data-spark-mounted]")).toBeAttached({
      timeout: 10_000,
    });

    const stored = await page.evaluate(() =>
      window.localStorage.getItem("spark:utms"),
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Record<string, string>;
    expect(parsed.utm_source).toBe("framer_test");
    expect(parsed.utm_medium).toBe("sponsored");
    expect(parsed.gclid).toBe("g_first");

    // Same browsing context, fresh visit without UTMs — embed.js should
    // pull the persisted values back into the iframe URL.
    await page.goto("/embed-demo.html");
    await expect(page.locator("iframe[data-spark-mounted]")).toBeAttached({
      timeout: 10_000,
    });
    const src =
      (await page
        .locator("iframe[data-spark-mounted]")
        .getAttribute("src")) ?? "";
    expect(src).toContain("utm_source=framer_test");
    expect(src).toContain("utm_medium=sponsored");
    expect(src).toContain("gclid=g_first");
  });

  test("re-mount after replaceState rebuilds UTMs from the localStorage snapshot", async ({
    page,
  }) => {
    await page.goto(
      "/embed-demo.html?utm_source=replace_test&utm_campaign=demo",
    );
    await expect(page.locator("iframe[data-spark-mounted]")).toBeAttached({
      timeout: 10_000,
    });

    // Simulate Framer: strip the querystring, tear down the existing
    // iframe, and let the MutationObserver re-mount when a new host
    // appears. Without the localStorage / initialUrl snapshot, the new
    // iframe would have no UTMs in its src.
    await page.evaluate(() => {
      document
        .querySelectorAll("[data-spark-form]")
        .forEach((el) => el.remove());
      history.replaceState({}, "", "/embed-demo.html");
      const host = document.createElement("div");
      host.setAttribute("data-spark-form", "demo-spark");
      host.setAttribute("data-spark-min-height", "560px");
      document.body.appendChild(host);
    });

    const iframe = page.locator("iframe[data-spark-mounted]");
    await expect(iframe).toBeAttached({ timeout: 10_000 });
    const src = (await iframe.getAttribute("src")) ?? "";
    expect(src).toContain("utm_source=replace_test");
    expect(src).toContain("utm_campaign=demo");
  });
});
