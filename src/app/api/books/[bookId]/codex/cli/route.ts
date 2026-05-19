import path from "node:path";
import { NextResponse } from "next/server";
import { buildCodexFallbackResponse } from "@/lib/codex/fallback";
import { codexBridge } from "@/lib/codex/cli-bridge";
import { readBookFile } from "@/lib/projects/files";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";
import {
  buildStudyInvestigation,
  type StudyInvestigation,
} from "@/lib/study/archive";

export const runtime = "nodejs";

const log = createLogger("api:codex-cli");

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as {
    message?: string;
    workspace?: string;
    workspacePath?: string;
    workspaceTabs?: Array<{ path: string; title: string }>;
    notes?: string;
    selectedSource?: string;
    selectedSources?: string[];
    instructions?: string;
    history?: Array<{ role: string; content: string }>;
  };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const storageRoot = process.env.ESSAI_DATA_ROOT
    ? path.resolve(process.env.ESSAI_DATA_ROOT)
    : path.resolve(/* turbopackIgnore: true */ process.cwd());
  const projectRoot = path.resolve(storageRoot, "projects", bookId);
  if (!projectRoot.startsWith(`${storageRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid book path" }, { status: 400 });
  }

  log.info("POST /codex/cli", {
    bookId,
    projectRoot,
    characters: message.length,
    bridge: "app-server",
  });

  try {
    const storage = getServerStorage();
    const selectedSources =
      body.selectedSources ?? legacySelectedSources(body.selectedSource);
    const manuscriptContext = await buildManuscriptContext(
      storage,
      bookId,
      selectedSectionsFromMessage(message),
    );
    const study = shouldAttachStudyContext(message)
      ? await buildStudyInvestigation(storage, bookId, {
          query: studyQueryFromMessage(message),
          exhaustive: false,
          sourcePaths: selectedSources,
        })
      : null;
    const studyContext = study ? formatStudyContext(study) : "";
    const fallback = (error: unknown) =>
      buildCodexFallbackResponse({
        message,
        study,
        manuscriptContext,
        error:
          error instanceof Error
            ? error.message
            : "Codex app-server bridge failed.",
      });
    const input = {
      projectRoot,
      message,
      workspace: body.workspace ?? body.notes ?? "",
      workspacePath: body.workspacePath,
      workspaceTabs: body.workspaceTabs,
      selectedSources,
      instructions: body.instructions ?? "",
      history: body.history ?? [],
      studyContext,
      manuscriptContext,
    };
    if (wantsStream(request)) {
      return streamCodexTurn(input, request.signal, fallback);
    }
    try {
      return NextResponse.json(await codexBridge.runTurn(input));
    } catch (error) {
      const fallbackResponse = fallback(error);
      if (fallbackResponse) return NextResponse.json(fallbackResponse);
      throw error;
    }
  } catch (error) {
    log.warn("codex app-server bridge failed", { bookId, error });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Codex app-server bridge failed.",
      },
      { status: 500 },
    );
  }
}

function studyQueryFromMessage(message: string) {
  const sourceSearch = message.match(/^Search query:\s*(.+)$/im)?.[1]?.trim();
  if (sourceSearch) return sourceSearch;
  const sections = selectedSectionsFromMessage(message);
  if (/Codex magic action:\s*Check accuracy\./i.test(message) && sections.length) {
    return sections.map(sectionSearchTerm).join(" ");
  }
  return message
    .replace(/^\/(search|related|source-links|backlinks)\s+/i, "")
    .trim();
}

function shouldAttachStudyContext(message: string) {
  return !/Codex magic action:\s*Check prose\./i.test(message);
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

function sectionSearchTerm(path: string) {
  return path
    .split("/")
    .at(-1)!
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ");
}

async function buildManuscriptContext(
  storage: ReturnType<typeof getServerStorage>,
  bookId: string,
  sections: string[],
) {
  const safeSections = sections.filter(
    (section) =>
      section.endsWith(".md") &&
      !section.startsWith("sources/") &&
      !section.startsWith("codex/") &&
      !section.includes(".."),
  );
  if (!safeSections.length) return "";
  const entries = await Promise.all(
    safeSections.slice(0, 8).map(async (section) => {
      try {
        const content = await readBookFile(storage, bookId, section);
        return [
          `## ${section}`,
          "",
          content.length > 16_000
            ? `${content.slice(0, 16_000).trimEnd()}\n\n[truncated]`
            : content,
        ].join("\n");
      } catch {
        return [`## ${section}`, "", "[could not read section]"].join("\n");
      }
    }),
  );
  return entries.join("\n\n---\n\n");
}

function formatStudyContext(study: StudyInvestigation) {
  const references = study.directReferences.slice(0, 8);
  const claims = study.claims.slice(0, 4);
  const objects = study.relatedObjects.slice(0, 4);
  return [
    `Query: ${study.query}`,
    `Scope: ${study.sourceCoverage.scope}`,
    `Coverage: ${study.sourceCoverage.matches} matches across ${study.sourceCoverage.chunks} indexed chunks; ${study.sourceCoverage.exactMatches} exact, ${study.sourceCoverage.lexicalMatches} lexical.`,
    references.length
      ? ""
      : "Direct references: none found in the Study index.",
    references.length ? "Direct references:" : "",
    ...references.map(
      (reference, index) =>
        `${index + 1}. ${reference.sourceFile}${reference.page ? ` p. ${reference.page}` : ""} (${reference.confidence}, ${reference.retrievalMethod})\n> ${reference.quote}`,
    ),
    claims.length ? "" : "",
    claims.length ? "Related claims:" : "",
    ...claims.map(
      (claim, index) =>
        `${index + 1}. ${claim.sourceFile}${claim.page ? ` p. ${claim.page}` : ""} (${claim.retrievalMethod})\n> ${claim.quote}`,
    ),
    objects.length ? "" : "",
    objects.length ? "Related objects:" : "",
    ...objects.map((object) => `- ${object.path}: ${object.excerpt}`),
    "",
    "Use these indexed passages as the primary source context. If they are insufficient, say so and name the missing evidence instead of inventing it.",
  ]
    .filter(Boolean)
    .join("\n");
}

function legacySelectedSources(selectedSource?: string) {
  return selectedSource ? [selectedSource] : [];
}

function wantsStream(request: Request) {
  const url = new URL(request.url);
  return (
    url.searchParams.get("stream") === "1" ||
    request.headers.get("accept")?.includes("text/event-stream")
  );
}

function streamCodexTurn(
  input: Parameters<typeof codexBridge.runTurn>[0],
  signal: AbortSignal,
  fallback: (error: unknown) => ReturnType<typeof buildCodexFallbackResponse>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // The browser may already have closed the SSE connection.
        }
      };
      const abort = () => {
        codexBridge.cancelProject(input.projectRoot);
        finish();
      };
      const heartbeat = setInterval(() => {
        send("heartbeat", { at: Date.now() });
      }, 2000);

      signal.addEventListener("abort", abort, { once: true });
      send("status", { status: "connected" });

      void codexBridge
        .runTurn(input, {
          onQueued: () => send("status", { status: "queued" }),
          onStarted: () => send("status", { status: "started" }),
          onDelta: (delta) => send("delta", { delta }),
        })
        .then((result) => {
          signal.removeEventListener("abort", abort);
          send("done", result);
          finish();
        })
        .catch((error) => {
          signal.removeEventListener("abort", abort);
          const fallbackResponse = fallback(error);
          if (fallbackResponse) {
            send("done", fallbackResponse);
          } else {
            send("error", {
              error:
                error instanceof Error
                  ? error.message
                  : "Codex app-server bridge failed.",
            });
          }
          finish();
        });
    },
    cancel() {
      codexBridge.cancelProject(input.projectRoot);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
