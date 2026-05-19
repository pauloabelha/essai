// @vitest-environment node

import { describe, expect, it } from "vitest";
import { commitResearchCard } from "@/lib/codex/cards";
import {
  backlinks,
  cardRelationships,
  readCodexCards,
  related,
} from "@/lib/codex/relationships";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";

describe("codex relationships", () => {
  it("creates deduplicated relationships and resolves backlinks", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
    });
    const card = (
      await commitResearchCard(storage, "book", {
        title: "Programmable Behavior",
        type: "concept",
        sources: [
          {
            sourcePath: "sources/files/raw/source.pdf",
            page: "12",
            retrievalMethod: "Study Direct Reference",
          },
          {
            sourcePath: "sources/files/raw/source.pdf",
            page: "12",
            retrievalMethod: "Study Direct Reference",
          },
        ],
        relatedConcepts: ["automata", "automata"],
        relatedClaims: ["claims/hydraulic-control.md"],
      })
    ).card;

    expect(cardRelationships(card)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "card-concept",
          to: "automata",
        }),
        expect.objectContaining({
          kind: "card-claim",
          to: "claims/hydraulic-control.md",
        }),
      ]),
    );
    expect(
      cardRelationships(card).filter((link) => link.to === "automata"),
    ).toHaveLength(1);

    const cards = await readCodexCards(storage, "book");
    expect(backlinks(cards, "claims/hydraulic-control.md")).toHaveLength(1);
    expect(related(cards, "programmable").cards[0].title).toBe(
      "Programmable Behavior",
    );
  });
});
