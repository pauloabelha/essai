import { EssaiApp } from "@/components/shell/essai-app";
import { listBooks } from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";

export default async function Home() {
  const books = await listBooks(getServerStorage());
  return <EssaiApp initialBooks={books} />;
}
