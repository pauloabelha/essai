import { describe, expect, it } from "vitest";
import { expandSlashCommand } from "@/lib/editor/slash";

describe("slash commands", () => {
  it("expands claim commands at the writing point", () => {
    expect(expandSlashCommand("Before\n/claim")).toBe(
      "Before\n> Claim:\n> Evidence needed:\n",
    );
  });

  it("expands concept commands", () => {
    expect(expandSlashCommand("/concept")).toBe("## Concept\n\nLinks:\n");
  });
});
