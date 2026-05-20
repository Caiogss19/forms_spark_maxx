import { expect, test } from "@playwright/test";

/**
 * Browser-driven flow tests. The demo-spark JSON is intentionally long
 * (18 steps), so we exercise enough of the runner to prove keyboard
 * navigation, validation surfacing, branching, and final submit.
 */

test.describe("FormRunner", () => {
  test("renders intro step and advances on Enter", async ({ page }) => {
    await page.goto("/f/demo-spark");
    await expect(
      page.getByRole("heading", { name: /Oi! Esse é o Spark Forms/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Bora começar/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: /Qual seu nome completo/ }),
    ).toBeVisible();
  });

  test("blocks gmail with a corporate-only error message", async ({ page }) => {
    await page.goto("/f/demo-spark");
    await page.keyboard.press("Enter"); // intro
    await page.getByRole("textbox").fill("Caio Smoke");
    await page.keyboard.press("Enter"); // name → email
    await page.getByRole("textbox").fill("caio@gmail.com");
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(
        /Use seu e-mail corporativo pra agilizarmos seu atendimento/i,
      ),
    ).toBeVisible();
  });

  test("happy path reaches the thank-you step", async ({ page }) => {
    await page.goto("/f/demo-spark");
    await page.keyboard.press("Enter"); // intro

    await page.getByRole("textbox").fill("Caio Smoke");
    await page.keyboard.press("Enter"); // → email

    await page.getByRole("textbox").fill("caio@empresa.com.br");
    await page.keyboard.press("Enter"); // → phone

    await page.getByRole("textbox").fill("11999999999");
    await page.keyboard.press("Enter"); // → company_name

    await page.getByRole("textbox").fill("Spark");
    await page.keyboard.press("Enter"); // → role (single_choice)

    // hotkey selects the first option (founder) which auto-advances.
    await page.keyboard.press("1");

    // company_size dropdown
    await page.locator("select").selectOption("11-50");
    await page.keyboard.press("Enter");

    // channels (multi_choice) — pick instagram, then click continue
    await page.keyboard.press("1");
    await page.getByRole("button", { name: /Continuar|OK/ }).first().click();

    // budget (currency) — type "10000" → R$ 100,00 (cents semantics)
    await page.locator('input[inputmode="numeric"]').fill("1000000");
    await page.keyboard.press("Enter");

    // nps scale — pick 8
    await page.keyboard.press("8");
    // Scale auto-advances; allow time.
    await page.waitForTimeout(400);

    // rating — pick 4
    await page.keyboard.press("4");
    await page.waitForTimeout(400);

    // launch_date — pick a date
    await page.locator('input[type="date"]').fill("2025-06-01");
    await page.keyboard.press("Enter");

    // campaigns_per_year (number)
    await page.locator('input[type="number"]').fill("12");
    await page.keyboard.press("Enter");

    // website (URL)
    await page.locator('input[type="url"]').fill("https://spark.com.br");
    await page.keyboard.press("Enter");

    // context (long_text)
    await page.locator("textarea").fill("Quero qualificar leads melhor.");
    await page.keyboard.press("Enter");

    // deck (file) — optional, skip with continue
    await page.getByRole("button", { name: /Continuar|OK/ }).first().click();

    // consent — toggle then continue
    await page.getByRole("button", { name: /Concordo/ }).click();
    await page.getByRole("button", { name: /Aceito e quero finalizar/ }).click();

    await expect(
      page.getByRole("heading", { name: /Tudo certo, Caio Smoke/ }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("branching: 'social_media' jumps from role to channels", async ({
    page,
  }) => {
    await page.goto("/f/demo-spark");
    await page.keyboard.press("Enter");
    await page.getByRole("textbox").fill("Caio");
    await page.keyboard.press("Enter");
    await page.getByRole("textbox").fill("caio@empresa.com.br");
    await page.keyboard.press("Enter");
    await page.getByRole("textbox").fill("11999999999");
    await page.keyboard.press("Enter");
    await page.getByRole("textbox").fill("Spark");
    await page.keyboard.press("Enter");
    // pick "Social Media" (4th option)
    await page.keyboard.press("4");
    // Logic rule sends us straight to "channels" (multi_choice), skipping
    // company_size.
    await expect(
      page.getByRole("heading", {
        name: /Em quais canais você já roda marketing/i,
      }),
    ).toBeVisible({ timeout: 4_000 });
  });
});
