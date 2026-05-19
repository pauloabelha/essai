import { expect, test } from "@playwright/test";

test("long scholar session preserves manuscript while auxiliary research accumulates", async ({
  page,
  request,
}) => {
  const title = `Long Session ${Date.now()}`;
  const created = await request.post("/api/books", {
    data: { title },
  });
  const book = (await created.json()) as { id: string };
  const manuscript =
    "# Main\n\nHuman paragraph about programmable flutes and durable scholarly evidence.";

  await request.put(`/api/books/${book.id}/files/main.md`, {
    data: { content: manuscript },
  });

  await page.goto(`/projects/${book.id}`);
  await expect(page.locator(".workspace")).toHaveClass(/mode-write/);
  await expect(page.getByText("Human paragraph")).toBeVisible();

  await page
    .getByLabel("Notes input")
    .fill("Review note: preserve the manuscript while gathering evidence.");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("Captured.")).toBeVisible();

  await page
    .getByLabel("Sources input")
    .fill("Hill 1993, p. 42: automatic sequence control matters here.");
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText("Source saved.")).toBeVisible();

  await page.getByLabel("Source file").setInputFiles({
    name: "long-session-source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      [
        "Long-session source notes.",
        "The automatic sequence in a programmable flute preserves evidence.",
        "A scholar should be able to move from source to Codex without altering the manuscript.",
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Upload File" }).click();
  await expect(page.getByText("File saved.")).toBeVisible();

  await page.getByRole("button", { name: "Study", exact: true }).click();
  await page
    .locator(".study-source-picker button", { hasText: /long-session-source/i })
    .click({ force: true });
  await page.getByLabel("Search current source").fill("automatic sequence");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: /long-session-source/i }),
  ).toBeVisible();
  await expect(page.locator(".source-reader pre")).toContainText(
    "automatic sequence",
    { timeout: 10_000 },
  );
  await expect(page.locator(".study-search-results")).toContainText(
    "automatic sequence",
  );

  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "codex/workspace.md" }),
  ).toBeVisible();

  const workspace = page.getByLabel("Codex Markdown workspace");
  await workspace.fill(
    [
      "# Codex Workspace",
      "",
      "## Long-session evidence",
      "",
      "Source: sources/raw.md",
      "Claim: automatic sequence control belongs in auxiliary research notes.",
      "",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "New" }).click();
  await expect(page.getByRole("tab", { name: "Codex note" })).toBeVisible();
  await workspace.fill(
    "# Relationship Followup\n\nTrack the connection without rewriting the human paragraph.\n",
  );
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("tab", { name: "Codex Workspace" }).click();
  await expect(workspace).toHaveValue(/Long-session evidence/);

  const codexInput = page.getByRole("textbox", { name: "Codex message" });
  await codexInput.fill(
    "/source-note Automatic sequence control remains auxiliary evidence.",
  );
  await page.getByLabel("Send Codex message").click();
  await expect(workspace).toHaveValue(/remains auxiliary evidence/);
  await expect(page.getByText("I added a source-aware note")).toBeVisible();

  await codexInput.fill("/search-project automatic sequence");
  await page.getByLabel("Send Codex message").click();
  await expect(
    page.getByText('Project search for "automatic sequence":'),
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
    page.getByText("/source-note Automatic sequence control remains"),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(workspace).toHaveValue(/remains auxiliary evidence/);
  await expect(
    page.getByRole("tab", { name: "Relationship Followup" }),
  ).toBeVisible();

  const codexWorkspace = (await (
    await request.get(`/api/books/${book.id}/files/codex/workspace.md`)
  ).json()) as { content: string };
  expect(codexWorkspace.content).toContain("Long-session evidence");
  expect(codexWorkspace.content).toContain("remains auxiliary evidence");

  const sideTabFiles = (await (
    await request.get(`/api/books/${book.id}/files`)
  ).json()) as unknown;
  expect(JSON.stringify(sideTabFiles)).toContain("codex/workspace-tabs/");
  expect(JSON.stringify(sideTabFiles)).toContain("codex/history/");

  const notes = (await (
    await request.get(`/api/books/${book.id}/files/notes.md`)
  ).json()) as { content: string };
  expect(notes.content).toContain("preserve the manuscript");

  const rawSource = (await (
    await request.get(`/api/books/${book.id}/files/sources/raw.md`)
  ).json()) as { content: string };
  expect(rawSource.content).toContain("automatic sequence control matters");
  expect(rawSource.content).toContain("long-session-source.txt");

  const finalMain = (await (
    await request.get(`/api/books/${book.id}/files/main.md`)
  ).json()) as { content: string };
  expect(finalMain.content).toBe(manuscript);
});
