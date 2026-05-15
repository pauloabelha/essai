import Link from "next/link";
import { listProjectPreviews } from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjectPreviews(getServerStorage());

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <p className="eyebrow">essai</p>
          <h1>Projects</h1>
        </div>
        <p>All book folders in the local archive.</p>
      </header>

      {projects.length ? (
        <section className="projects-list" aria-label="Projects">
          {projects.map(({ book, excerptHtml, fileCount }) => (
            <Link
              key={book.id}
              href={`/projects/${book.id}`}
              className="project-row"
            >
              <div className="project-row-meta">
                <h2>{book.title}</h2>
                {book.subtitle ? <p>{book.subtitle}</p> : null}
                <span>
                  {fileCount} files · Updated{" "}
                  {formatDate(book.updatedAt || book.createdAt)}
                </span>
              </div>
              <article
                className="project-excerpt"
                dangerouslySetInnerHTML={{ __html: excerptHtml }}
              />
            </Link>
          ))}
        </section>
      ) : (
        <section className="projects-empty">
          <h2>No projects yet.</h2>
          <p>
            Create one from the writing screen to begin a portable folder under
            projects/.
          </p>
          <Link href="/">Open Essai</Link>
        </section>
      )}
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
