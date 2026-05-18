import path from "node:path";
import { expect, test } from "@playwright/test";

test("native PDF exact search resolves geometry highlights", async ({
  page,
  request,
}) => {
  const title = `PDF Search ${Date.now()}`;
  const created = await request.post("/api/books", { data: { title } });
  const book = (await created.json()) as { id: string };
  await page.goto(`/projects/${book.id}`);

  await page.getByLabel("Source file").setInputFiles(
    path.join(process.cwd(), "tests/fixtures/pdfs/repeated-word.pdf"),
  );
  await page.getByRole("button", { name: "Upload File" }).click();
  await expect(page.getByText("File saved.")).toBeVisible();

  await page.getByRole("button", { name: "Study" }).click();
  await page.getByRole("button", { name: /repeated-word/i }).click();
  await page.getByLabel("Search current source").fill("machine");
  await page.keyboard.press("Enter");
  await page.locator(".study-search-results button").first().click();

  await expect(page.getByLabel("PDF page")).toHaveValue("1");
  await expect(page.locator(".pdf-highlight-box")).toHaveCount(1);
  await expect(page.locator(".pdf-highlight-box.active")).toHaveCount(1);

  const firstBoxBefore = await page
    .locator(".pdf-highlight-box")
    .first()
    .boundingBox();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => {
    const box = await page.locator(".pdf-highlight-box").first().boundingBox();
    return box && firstBoxBefore ? box.width > firstBoxBefore.width : false;
  }).toBe(true);

  await page.locator(".pdf-study-pages").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.locator(".pdf-study-pages").evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(page.locator(".pdf-highlight-box.active")).toHaveCount(1);
});

test("native PDF phrase search highlights the phrase, not loose terms", async ({
  page,
  request,
}) => {
  const title = `PDF Phrase ${Date.now()}`;
  const created = await request.post("/api/books", { data: { title } });
  const book = (await created.json()) as { id: string };
  await page.goto(`/projects/${book.id}`);

  await page.getByLabel("Source file").setInputFiles(
    path.join(process.cwd(), "tests/fixtures/pdfs/phrase-across-runs.pdf"),
  );
  await page.getByRole("button", { name: "Upload File" }).click();
  await expect(page.getByText("File saved.")).toBeVisible();

  await page.getByRole("button", { name: "Study" }).click();
  await page.getByRole("button", { name: /phrase-across-runs/i }).click();
  await page.getByLabel("Search current source").fill("tax machine");
  await page.keyboard.press("Enter");
  await page.locator(".study-search-results button").first().click();

  await expect(page.getByLabel("PDF page")).toHaveValue("1");
  await expect(page.locator(".pdf-highlight-box")).toHaveCount(1);
});
