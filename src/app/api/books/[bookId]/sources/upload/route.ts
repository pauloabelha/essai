import { NextResponse } from "next/server";
import { appendSourceFile, parseSourceKind } from "@/lib/projects/sources";
import { getServerStorage } from "@/lib/storage/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      return NextResponse.json(
        { error: "Source file is required" },
        { status: 400 },
      );
    }

    const result = await appendSourceFile(
      getServerStorage(),
      bookId,
      {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      },
      kind,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Source file upload failed";
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
