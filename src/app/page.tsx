import { listBooks } from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";
import { redirect } from "next/navigation";
import { EssaiApp } from "@/components/shell/essai-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const books = await listBooks(getServerStorage());
  if (books[0]) redirect(`/projects/${books[0].id}`);
  return <EssaiApp initialBooks={books} />;
}
