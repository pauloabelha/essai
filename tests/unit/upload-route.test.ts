import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/books/[bookId]/sources/upload/route";

function context(bookId = "missing-book") {
  return { params: Promise.resolve({ bookId }) };
}

describe("source file upload route", () => {
  it("returns a JSON error when no file is submitted", async () => {
    const response = await POST(
      new Request("http://local.test", {
        method: "POST",
        body: new FormData(),
      }),
      context(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Source file is required",
    });
  });
});
