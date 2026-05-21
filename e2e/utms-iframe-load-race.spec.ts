import { expect, test } from "@playwright/test";

/**
 * Regression test for the iframe-`load` race: when the iframe loads
 * synchronously (cached resource, or pre-warmed by a previous mount on
 * the same page), the `load` listener has to be attached *before*
 * appendChild / src assignment, otherwise the parent's tracking
 * postMessage is missed and the iframe is left with whatever UTMs
 * happened to be in its URL.
 */
test.describe("iframe load handler races", () => {
  test("postMessage tracking still arrives after a same-page re-mount", async ({
    page,
  }) => {
    await page.goto(
      "/embed-demo.html?utm_source=cached_test&utm_campaign=race",
    );
    await expect(page.locator("iframe[data-spark-mounted]")).toBeAttached({
      timeout: 10_000,
    });

    // Tear down and remount the iframe; the cached embed page can fire
    // `load` synchronously, exercising the listener-before-appendChild
    // ordering.
    await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>("[data-spark-form]");
      if (!host) return;
      host.querySelector("iframe")?.remove();
      (
        window as unknown as {
          SparkForms?: { mount?: (el: HTMLElement) => void };
        }
      ).SparkForms?.mount?.(host);
    });

    // New iframe should attach and receive tracking via postMessage.
    await expect(page.locator("iframe[data-spark-mounted]")).toBeAttached({
      timeout: 10_000,
    });

    const tracking = await page.evaluate(async () => {
      const f = document.querySelector<HTMLIFrameElement>(
        "iframe[data-spark-mounted]",
      );
      const cw = f?.contentWindow;
      if (!cw) return null;
      for (let i = 0; i < 50; i++) {
        const raw = cw.sessionStorage.getItem("spark-forms:tracking");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          // Wait until the parent has actually posted page_url, not just
          // the initial URL-param capture.
          if (parsed.utm_source && parsed.page_url) return parsed;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      return null;
    });

    expect(tracking).not.toBeNull();
    expect(tracking!.utm_source).toBe("cached_test");
    expect(tracking!.utm_campaign).toBe("race");
    expect(tracking!.page_url).toContain("/embed-demo.html");
  });
});
