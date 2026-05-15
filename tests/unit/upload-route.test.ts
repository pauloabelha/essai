import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/books/[bookId]/sources/upload/route";

function context(bookId = "missing-book") {
  return { params: Promise.resolve({ bookId }) };
}

describe("PDF source upload route", () => {
  it("returns a JSON error when no PDF is submitted", async () => {
    const response = await POST(
      new Request("http://local.test", {
        method: "POST",
        body: new FormData(),
      }),
      context(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF file is required",
    });
  });

  it("returns a JSON error for non-PDF uploads", async () => {
    const form = new FormData();
    form.append("file", new File(["not a pdf"], "notes.txt"));

    const response = await POST(
      new Request("http://local.test", {
        method: "POST",
        body: form,
      }),
      context(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only PDF sources can be uploaded",
    });
  });
});
