import { EssaiApp } from "@/components/shell/essai-app";
import { listBooks } from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const books = await listBooks(getServerStorage());
  return <EssaiApp initialBooks={books} initialBookId={bookId} />;
}
