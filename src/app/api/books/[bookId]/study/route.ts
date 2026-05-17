import { NextResponse } from "next/server";
import { buildStudyInvestigation } from "@/lib/study/archive";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";

const log = createLogger("api:study");

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const exhaustive = url.searchParams.get("mode") !== "fast";
  const sourcePaths = url.searchParams.getAll("source");
  log.info("GET /study", { bookId, query, exhaustive, sourcePaths });
  const study = await log.time("build investigation", () =>
    buildStudyInvestigation(getServerStorage(), bookId, {
      query,
      exhaustive,
      sourcePaths,
    }),
  );
  log.info("GET /study response", {
    bookId,
    query: study.query,
    selectedSource: study.selectedSource?.path ?? null,
    directReferences: study.directReferences.length,
    claims: study.claims.length,
    chunks: study.sourceCoverage.chunks,
  });
  return NextResponse.json(study);
}
