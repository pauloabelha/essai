# PATCH-001: Long-Session Playwright Workflow

## Intent

Add a realistic Playwright workflow that behaves like a scholar using Essai across Write, Study, Codex, sources, notes, and project reopening.

## Proposed File

`tests/e2e/long-session.spec.ts`

## Sketch

```ts
import { expect, test } from "@playwright/test";

test("long scholar session preserves manuscript and provenance", async ({ page, request }) => {
  const title = `Long Session ${Date.now()}`;
  const created = await request.post("/api/books", { data: { title } });
  const book = await created.json();

  await request.put(`/api/books/${book.id}/files/main.md`, {
    data: { content: "# Main\n\nHuman paragraph that must remain sovereign." },
  });

  await page.goto(`/projects/${book.id}`);
  await page.getByLabel("Sources input").fill("Hill 1993, p. 42: automatic sequence control.");
  await page.getByRole("button", { name: "Commit" }).click();

  await page.getByRole("button", { name: "Study" }).click();
  await page.getByRole("searchbox").fill("automatic sequence");
  await expect(page.getByText(/Exact Match|Lexical Match/)).toBeVisible();

  await page.getByRole("button", { name: "Codex" }).click();
  await page.getByLabel("Codex Markdown workspace").fill("# Session\n\nSource-grounded note.\n");
  await page.getByRole("button", { name: "Save" }).click();

  await page.reload();
  await expect(page.getByText("Human paragraph that must remain sovereign")).toBeVisible();

  const finalMain = await (await request.get(`/api/books/${book.id}/files/main.md`)).json();
  expect(finalMain.content).toBe("# Main\n\nHuman paragraph that must remain sovereign.");
});
```

## Notes

The actual implementation should use selectors that match the rendered Study search controls. It should capture screenshots on failure through Playwright config rather than committing every run artifact.

