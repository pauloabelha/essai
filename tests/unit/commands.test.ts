import { describe, expect, it } from "vitest";

const commands = [
  "Open file",
  "New note",
  "Save",
  "Toggle reading mode",
  "Toggle preview",
  "Reindex inbox",
  "Suggest links",
  "Extract claims",
  "Open README",
  "Open manuscript",
  "Quick Thought",
  "Open Current Notes",
  "Toggle focus mode",
  "/claim",
];

describe("command palette actions", () => {
  it("contains the expected writing commands", () => {
    expect(commands).toContain("Save");
    expect(commands).toContain("Toggle reading mode");
    expect(commands).toContain("Extract claims");
    expect(commands).toContain("Quick Thought");
    expect(commands).toContain("/claim");
  });
});
