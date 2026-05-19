import { expect, test } from "@playwright/test";

test("codex reads project files and commits only center markdown workspace", async ({
  page,
  request,
}) => {
  const title = `Codex Book ${Date.now()}`;
  const created = await request.post("/api/books", {
    data: { title },
  });
  const book = (await created.json()) as { id: string };
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });
  await request.put(`/api/books/${book.id}/files/main.md`, {
    data: {
      content:
        "# Main\n\nHuman-written section about programmable flutes and source-grounded claims.",
    },
  });
  await page.goto(`/projects/${book.id}`);

  await page
    .getByLabel("Sources input")
    .fill("Hill 1993, p. 42: automatic sequence control.");
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText("Source saved.")).toBeVisible();

  await page.getByRole("button", { name: "Codex" }).click();
  await expect(
    page.getByRole("heading", { name: "codex/workspace.md" }),
  ).toBeVisible();
  await expect(
    page.getByText(/codex\/workspace\.md (loaded|created)\./),
  ).toBeVisible();
  const codexPanel = page.getByRole("complementary", {
    name: "Codex messages",
  });
  const codexPanelBefore = await codexPanel.boundingBox();
  const codexGrip = page.getByLabel("Resize Codex panel");
  const codexGripBox = await codexGrip.boundingBox();
  expect(codexPanelBefore).not.toBeNull();
  expect(codexGripBox).not.toBeNull();
  await page.mouse.move(codexGripBox!.x + 3, codexGripBox!.y + 80);
  await page.mouse.down();
  await page.mouse.move(codexGripBox!.x - 80, codexGripBox!.y + 80);
  await page.mouse.up();
  const codexPanelAfter = await codexPanel.boundingBox();
  expect(codexPanelAfter!.width).toBeGreaterThan(codexPanelBefore!.width + 50);
  await expect(
    page.getByRole("heading", { name: "Magic Calls" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Search in sources/ }).click();
  await expect(page.getByPlaceholder("programmable flute")).toBeVisible();
  await expect(page.getByText(/sources/).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: /Check accuracy/ }).click();
  const sectionOptions = page.locator(".codex-magic-options");
  await expect(sectionOptions).toContainText("Main");
  await expect(sectionOptions).not.toContainText("main.md");
  await page.getByRole("button", { name: "Cancel" }).click();

  const workspace = page.getByLabel("Codex Markdown workspace");
  await workspace.fill(
    "# Codex Workspace\n\nManual note from the center editor.\n",
  );

  const codexInput = page.getByRole("textbox", { name: "Codex message" });

  await codexInput.fill(
    "/source-note Automatic sequence control matters here.",
  );
  await page.getByLabel("Send Codex message").click();
  await expect(workspace).toHaveValue(
    /Automatic sequence control matters here/,
  );
  await expect(page.getByText("I added a source-aware note")).toBeVisible();
  await page.getByLabel("Copy user message").last().click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("/source-note Automatic sequence control matters here.");
  await page.getByLabel("Copy codex message").last().click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("I added a source-aware note");

  await codexInput.fill("/search-project programmable flutes");
  await page.getByLabel("Send Codex message").click();
  await expect(
    page.getByText('Project search for "programmable flutes":'),
  ).toBeVisible();
  await expect(page.getByText("main.md").first()).toBeVisible();

  await codexInput.fill("/examine-section main.md");
  await page.getByLabel("Send Codex message").click();
  await expect(
    page.getByText("Read-only access. I will not edit this file."),
  ).toBeVisible();

  await codexInput.fill("/commit-workspace");
  await page.getByLabel("Send Codex message").click();
  await expect(
    page.getByText(
      "Committed the center Markdown workspace to codex/workspace.md.",
    ),
  ).toBeVisible();
  await page.getByLabel("Open Codex history").click();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(
    page.getByText("/source-note Automatic sequence control matters here."),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /source-note Automatic sequence control matters here/,
    })
    .click();
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible();
  await expect(
    page.getByText(
      "Committed the center Markdown workspace to codex/workspace.md.",
    ),
  ).toBeVisible();

  const files = (await (
    await request.get(`/api/books/${book.id}/files`)
  ).json()) as unknown;
  expect(JSON.stringify(files)).toContain("codex/history/");

  const codexWorkspace = (await (
    await request.get(`/api/books/${book.id}/files/codex/workspace.md`)
  ).json()) as { content: string };
  expect(codexWorkspace.content).toContain(
    "Manual note from the center editor.",
  );
  expect(codexWorkspace.content).toContain(
    "Automatic sequence control matters here.",
  );

  const finalMain = (await (
    await request.get(`/api/books/${book.id}/files/main.md`)
  ).json()) as { content: string };
  expect(finalMain.content).toContain("Human-written section");
  expect(finalMain.content).not.toContain(
    "Automatic sequence control matters here.",
  );
});
