import { NextResponse } from "next/server";
import { appendPdfSource, parseSourceKind } from "@/lib/projects/sources";
import { getServerStorage } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await params;
  const form = await request.formData();
  const file = form.get("file");
  const kind = parseSourceKind(form.get("kind"));

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "PDF file is required" },
      { status: 400 },
    );
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json(
      { error: "Only PDF sources can be uploaded" },
      { status: 400 },
    );
  }

  const result = await appendPdfSource(
    getServerStorage(),
    bookId,
    {
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    },
    kind,
  );

  return NextResponse.json(result);
}
