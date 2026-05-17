import { describe, expect, it } from "vitest";

const commands = [
  "Open file",
  "New note",
  "Save",
  "Toggle preview",
  "Reindex inbox",
  "Suggest links",
  "Extract claims",
  "Open README",
  "Open manuscript",
  "Focus Notes",
  "Open Notes",
  "Toggle focus mode",
  "/claim",
];

describe("command palette actions", () => {
  it("contains the expected writing commands", () => {
    expect(commands).toContain("Save");
    expect(commands).toContain("Toggle preview");
    expect(commands).toContain("Extract claims");
    expect(commands).toContain("Focus Notes");
    expect(commands).toContain("/claim");
  });
});
