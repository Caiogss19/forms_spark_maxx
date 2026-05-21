import { expect, test } from "@playwright/test";

/**
 * Verifies UTMs that arrive on the host page (Framer / Webflow / plain
 * HTML, etc.) make it into the iframe's tracking snapshot — both via
 * the forwarded URL params (covers SSR / first paint) and via the
 * postMessage handshake (covers SPA edits and late updates).
 */
test.describe("UTMs forwarded via embed.js", () => {
  test("parent URL UTMs reach the iframe URL and the tracking snapshot", async ({
    page,
  }) => {
    await page.goto(
      "/embed-demo.html?utm_source=meta&utm_medium=cpc&utm_campaign=launch&gclid=abc123&ttclid=tt9&msclkid=ms5",
    );

    const iframe = page.locator("iframe[data-spark-mounted]");
    await expect(iframe).toBeAttached({ timeout: 10_000 });

    // Forwarded UTMs end up on the iframe src so the form has them at
    // first paint, before any postMessage could arrive.
    const src = (await iframe.getAttribute("src")) ?? "";
    expect(src).toContain("utm_source=meta");
    expect(src).toContain("utm_medium=cpc");
    expect(src).toContain("utm_campaign=launch");
    expect(src).toContain("gclid=abc123");
    expect(src).toContain("ttclid=tt9");
    expect(src).toContain("msclkid=ms5");
    expect(src).toContain("_p=");

    // Wait for the iframe's React tree to mount and persist tracking
    // into its sessionStorage. We avoid depending on any particular DOM
    // text — the embed.js fix is all about *tracking*, not rendering.
    const tracking = await page.evaluate(async () => {
      const f = document.querySelector<HTMLIFrameElement>(
        "iframe[data-spark-mounted]",
      );
      const cw = f?.contentWindow;
      if (!cw) return null;
      for (let i = 0; i < 100; i++) {
        const raw = cw.sessionStorage.getItem("spark-forms:tracking");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          if (parsed.utm_source && parsed.page_url) return parsed;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      return null;
    });

    expect(tracking).not.toBeNull();
    expect(tracking!.utm_source).toBe("meta");
    expect(tracking!.utm_medium).toBe("cpc");
    expect(tracking!.utm_campaign).toBe("launch");
    expect(tracking!.gclid).toBe("abc123");
    expect(tracking!.ttclid).toBe("tt9");
    expect(tracking!.msclkid).toBe("ms5");

    // page_url MUST be the parent (host) URL, not the iframe URL —
    // n8n's extractUtmsFromUrl(source.page_url) depends on it and so
    // does `pagina_origem` in RD Station / Pipedrive.
    expect(tracking!.page_url).toContain("/embed-demo.html");
    expect(tracking!.page_url).not.toContain("/embed/demo-spark");
  });
});
