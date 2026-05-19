import type { ResearchCard as ResearchCardModel } from "@/lib/codex/cards";
import { provenanceLabel } from "@/lib/codex/provenance";

export function ResearchCard({ card }: { card: ResearchCardModel }) {
  return (
    <article className="research-card">
      <header>
        <p className="eyebrow">{card.type}</p>
        <h3>{card.title}</h3>
      </header>
      {card.excerpt ? <blockquote>{card.excerpt}</blockquote> : null}
      {card.commentary ? <p>{card.commentary}</p> : null}
      <dl>
        <div>
          <dt>Sources</dt>
          <dd>
            {card.sources.length
              ? card.sources.map(provenanceLabel).join("; ")
              : "No source attached"}
          </dd>
        </div>
        <div>
          <dt>Chapters</dt>
          <dd>{card.relatedChapters?.join("; ") || "Unlinked"}</dd>
        </div>
        <div>
          <dt>Concepts</dt>
          <dd>{card.relatedConcepts?.join("; ") || "Unlinked"}</dd>
        </div>
        <div>
          <dt>Claims</dt>
          <dd>{card.relatedClaims?.join("; ") || "Unlinked"}</dd>
        </div>
      </dl>
    </article>
  );
}
