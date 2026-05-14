import { expect, test } from "@playwright/test";

test("create project, edit, save, read, and navigate wiki links", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Book title").fill("E2E Book");
  await page.getByRole("button", { name: /new book/i }).click();

  await expect(page.locator("select")).toHaveValue("e2e-book");
  await page.getByRole("button", { name: "manuscript/main.md" }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.type("A sentence about [[music-cylinder]].");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S");
  await expect(page.getByText("saved")).toBeVisible();

  await page.getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.locator(".prose-reading")).toContainText("A sentence about");
  await page.getByRole("button", { name: "music-cylinder" }).click();
  await expect(page.getByText("objects/music-cylinder.md")).toBeVisible();
});
