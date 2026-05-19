// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  commitResearchCard,
  previewResearchCardWrite,
} from "@/lib/codex/cards";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";

describe("codex research cards", () => {
  it("previews safe writes without touching storage", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/main.md": "Human manuscript.",
    });

    const preview = previewResearchCardWrite(
      {
        title: "Mechanical Sequence Control",
        type: "concept",
        excerpt: "automatic sequence",
        commentary: "A control concept worth linking.",
        sources: [
          {
            sourcePath: "sources/files/raw/Hill1993.pdf",
            page: "42",
            retrievalMethod: "Study Direct Reference",
          },
        ],
        relatedChapters: ["chapters/history.md"],
      },
      new Date("2026-05-18T12:00:00Z"),
    );

    expect(preview.path).toBe("codex/cards/mechanical-sequence-control.md");
    expect(preview.content).toContain("# Mechanical Sequence Control");
    await expect(
      storage.readFile("projects/book/codex/cards/mechanical-sequence-control.md"),
    ).rejects.toThrow();
    expect(await storage.readFile("projects/book/main.md")).toBe(
      "Human manuscript.",
    );
  });

  it("commits durable card files while leaving the manuscript untouched", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/main.md": "Human manuscript.",
    });

    await commitResearchCard(
      storage,
      "book",
      {
        title: "Hydraulic Control",
        type: "claim",
        sources: [
          {
            sourcePath: "sources/Claims.md",
            page: "index",
            retrievalMethod: "Manual Codex Link",
          },
        ],
      },
      new Date("2026-05-18T12:00:00Z"),
    );

    expect(
      await storage.readFile("projects/book/codex/cards/hydraulic-control.md"),
    ).toContain("sources/Claims.md");
    expect(await storage.readFile("projects/book/main.md")).toBe(
      "Human manuscript.",
    );
  });
});
