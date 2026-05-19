import type { StudyInvestigation, StudyPassage } from "@/lib/study/archive";

export interface CodexFallbackResponse {
  output: string;
  workspaceAppend: string;
  workspaceReplace: string;
  workspacePath: string;
  workspaceCreates: Array<{ title: string; content: string }>;
}

export function buildCodexFallbackResponse({
  message,
  study,
  error,
}: {
  message: string;
  study: StudyInvestigation;
  error: string;
}): CodexFallbackResponse | null {
  if (!isMagicAccuracy(message) && !isMagicProse(message)) return null;
  const action = isMagicAccuracy(message) ? "accuracy" : "prose";
  const title =
    action === "accuracy" ? "Codex accuracy fallback" : "Codex prose fallback";
  const sections = selectedSectionsFromMessage(message);
  const directReferences = study.directReferences.slice(0, 5);
  const claims = study.claims.slice(0, 3);
  const memo = [
    `## ${title}`,
    "",
    `Codex CLI did not finish: ${error}`,
    "",
    sections.length
      ? `Selected section${sections.length === 1 ? "" : "s"}: ${sections.join(", ")}`
      : "Selected sections: all manuscript sections",
    `Study scope: ${study.sourceCoverage.scope}`,
    `Indexed coverage: ${study.sourceCoverage.matches} matches across ${study.sourceCoverage.chunks} chunks.`,
    "",
    "### What can be said from indexed evidence",
    ...formatPassageList(directReferences),
    "",
    "### Claims needing follow-up",
    claims.length
      ? claims
          .map((claim) => `- ${passagePointer(claim)}: ${claim.quote}`)
          .join("\n")
      : "- No claim-led matches were found in `sources/Claims.md` for this query.",
    "",
    "### Next searches",
    "- Rerun the magic action after the Codex bridge is responsive.",
    "- Search narrower terms from the section, such as object names, dates, mechanisms, and source authors.",
  ].join("\n");

  return {
    output: [
      `Codex CLI did not finish, so Essai wrote a local ${action} fallback memo to the center workspace.`,
      `Reason: ${error}`,
      directReferences.length
        ? `Indexed evidence was available from ${directReferences.length} passage${directReferences.length === 1 ? "" : "s"}.`
        : "No direct indexed evidence was available for the fallback query.",
    ].join("\n"),
    workspaceAppend: memo,
    workspaceReplace: "",
    workspacePath: "",
    workspaceCreates: [],
  };
}

function isMagicAccuracy(message: string) {
  return /Codex magic action:\s*Check accuracy\./i.test(message);
}

function isMagicProse(message: string) {
  return /Codex magic action:\s*Check prose\./i.test(message);
}

function selectedSectionsFromMessage(message: string) {
  const marker = "Selected manuscript sections:";
  const index = message.indexOf(marker);
  if (index < 0) return [];
  return message
    .slice(index + marker.length)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function formatPassageList(passages: StudyPassage[]) {
  if (!passages.length) {
    return [
      "- No direct indexed passages matched strongly enough. Treat the manuscript claims as unverified until a narrower search finds evidence.",
    ];
  }
  return passages.map(
    (passage) => `- ${passagePointer(passage)}: ${passage.quote}`,
  );
}

function passagePointer(passage: StudyPassage) {
  return `${passage.sourceFile}${passage.page ? ` p. ${passage.page}` : ""}`;
}
