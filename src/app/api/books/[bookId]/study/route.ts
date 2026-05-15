import { NextResponse } from "next/server";
import { buildStudyInvestigation } from "@/lib/study/archive";
import { getServerStorage } from "@/lib/storage/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const exhaustive = url.searchParams.get("mode") !== "fast";
  const sourcePaths = url.searchParams.getAll("source");
  return NextResponse.json(
    await buildStudyInvestigation(getServerStorage(), bookId, {
      query,
      exhaustive,
      sourcePaths,
    }),
  );
}
