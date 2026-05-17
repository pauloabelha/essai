import { NextResponse } from "next/server";
import { appendSourceFile, parseSourceKind } from "@/lib/projects/sources";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const log = createLogger("api:upload");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const kind = parseSourceKind(form.get("kind"));

    if (!isUploadFile(file)) {
      log.warn("POST /sources/upload rejected", {
        bookId,
        reason: "missing file",
      });
      return NextResponse.json(
        { error: "Source file is required" },
        { status: 400 },
      );
    }

    log.info("POST /sources/upload", {
      bookId,
      kind,
      name: file.name,
      size: file.size,
      type: file.type,
    });
    const result = await appendSourceFile(
      getServerStorage(),
      bookId,
      {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
      kind,
    );

    log.info("POST /sources/upload response", result);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Source file upload failed";
    log.error("POST /sources/upload failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "name" in value &&
    typeof value.name === "string"
  );
}
