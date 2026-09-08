import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import axe from "axe-core";
const base = process.argv[2] || "http://127.0.0.1:3127";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const route of [
      "/home",
      "/services",
      "/quote",
      "/privacy",
      "/terms",
      "/areas/salinas",
      "/areas/carmel-valley",
      "/coop-board",
    ]) {
      const response = await page.goto(base + route, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200, route);
      assert.equal(response.headers()["x-content-type-options"], "nosniff", route + " content type protection");
      assert.equal(response.headers()["x-frame-options"], "SAMEORIGIN", route + " frame protection");
      assert.equal(response.headers()["referrer-policy"], "strict-origin-when-cross-origin", route + " referrer policy");
      assert.equal(await page.locator("h1").count(), 1, route + " h1");
      assert.equal(await page.locator("main").count(), 1, route + " main");
      assert.equal(
        await page.locator("link[rel=canonical]").getAttribute("href"),
        "https://californiamailer.com" + route,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        route + " overflow",
      );
      await page.evaluate(axe.source);
      const violations = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          })
        ).violations.filter((v) => ["serious", "critical"].includes(v.impact)),
      );
      assert.deepEqual(
        violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        route + " axe",
      );
      if (route === "/home") {
        await page.screenshot({
          path: "home-" + width + ".png",
          fullPage: true,
        });
      }
    }
    await page.goto(base + "/quote?service=design", {
      waitUntil: "networkidle",
    });
    assert.equal(await page.locator("#quote-service").inputValue(), "design");
    await page.getByLabel("Your name", { exact: true }).fill("Synthetic QA");
    await page
      .getByLabel("Business name", { exact: true })
      .fill("Example Fixture");
    await page
      .getByLabel("Email address", { exact: true })
      .fill("qa@example.test");
    await page
      .getByLabel("Target city, ZIP codes, or neighborhoods", { exact: true })
      .fill("Salinas");
    await page.route("**/api/send-email", (r) =>
      r.fulfill({
        status: 502,
        contentType: "application/json",
        body: '{"error":"fixture"}',
      }),
    );
    await page.getByRole("button", { name: "Request a written quote" }).click();
    await page.locator(".cm-error[role=alert]").waitFor();
    assert.equal(await page.locator("#quote-area").inputValue(), "Salinas");
    await page.unroute("**/api/send-email");
    await page.route("**/api/send-email", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"success":true}',
      }),
    );
    await page.getByRole("button", { name: "Request a written quote" }).click();
    await page.getByRole("heading", { name: "Request submitted." }).waitFor();
    await page.close();
    console.log("PASS responsive pages and mocked quote flow", width);
  }
  const invalid = await fetch(base + "/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "quote" }),
  });
  assert.equal(invalid.status, 400);
  const foreign = await fetch(base + "/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
    },
    body: "{}",
  });
  assert.equal(foreign.status, 403);
  const checkout = await fetch(base + "/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(checkout.status, 503);
  console.log("PASS API validation, origin rejection, and disabled checkout");
} finally {
  await browser.close();
}
