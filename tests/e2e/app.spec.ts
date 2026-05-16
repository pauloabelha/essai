import { expect, test } from "@playwright/test";

test("create project, capture notes and sources, write, focus, read, and navigate wiki links", async ({
  page,
  request,
}) => {
  const title = `E2E Book ${Date.now()}`;
  const created = await request.post("/api/books", {
    data: { title },
  });
  const book = (await created.json()) as { id: string };
  await page.goto(`/projects/${book.id}`);

  await expect(
    page
      .getByRole("complementary", { name: "Manuscript sections" })
      .getByRole("combobox"),
  ).toHaveValue(book.id);
  await expect(page).toHaveURL(new RegExp(`/projects/${book.id}`));
  await expect(page.locator(".workspace")).toHaveClass(/mode-write/);
  await expect(page.locator(".preview-shell")).toHaveCount(0);
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".cm-scroller")).toHaveCSS(
    "background-color",
    "rgb(15, 14, 12)",
  );
  await page.getByRole("button", { name: "Light mode" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("button", { name: "Main", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Sections" }).getByText("main.md"),
  ).toHaveCount(0);

  await page.getByLabel("Notes input").fill("A captured note for later.");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Captured.")).toBeVisible();
  await expect(page.getByLabel("Notes input")).toHaveValue("");
  await page.getByLabel("Sources input").fill("https://example.com/source");
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText("Source saved.")).toBeVisible();
  await page.getByRole("button", { name: "Study" }).click();
  await page.getByRole("button", { name: "raw.md" }).click();
  await page.getByLabel("Study search").fill("example source");
  await expect(page.locator(".app-frame")).toHaveClass(/study-active/);
  await expect(
    page.getByRole("complementary", { name: "Input" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Direct References" }),
  ).toBeVisible();
  const directReferences = page.locator(".study-section").filter({
    has: page.getByRole("heading", { name: "Direct References" }),
  });
  await expect(directReferences).toContainText("https://example.com/source", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Write" }).click();
  await page.getByLabel("Source file").setInputFiles({
    name: "sample-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("source notes\n"),
  });
  await page.getByRole("button", { name: "Upload File" }).click();
  await expect(page.getByText("File saved.")).toBeVisible();
  const rawSource = (await (
    await request.get(`/api/books/${book.id}/files/sources/raw.md`)
  ).json()) as { content: string };
  expect(rawSource.content).toContain("https://example.com/source");
  expect(rawSource.content).toContain("sample-notes.txt");
  const notes = (await (
    await request.get(`/api/books/${book.id}/files/notes.md`)
  ).json()) as { content: string };
  expect(notes.content).toContain("A captured note for later.");

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Main" })
    .click();
  await page.locator(".cm-content").click();
  await page.keyboard.type("A sentence about [[music-cylinder]].");
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+S" : "Control+S",
  );

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator(".preview-shell")).toContainText(
    "A sentence about",
  );
  await page.getByRole("button", { name: "Write" }).click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+." : "Control+.",
  );
  await expect(page.locator(".app-frame")).toHaveClass(/focus-active/);
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+." : "Control+.",
  );

  await page
    .getByLabel("Writing mode")
    .getByRole("button", { name: "Read" })
    .click();
  await expect(page.locator(".prose-reading")).toContainText(
    "A sentence about",
  );
  await page.getByRole("button", { name: "music-cylinder" }).click();
  await expect(page.getByText("objects/music-cylinder.md")).toBeVisible();
});
