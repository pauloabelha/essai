import { GitBranch } from "lucide-react";
import type { RelatedCodexResult } from "@/lib/codex/relationships";

export function RelationshipInspector({
  result,
  backlinks,
}: {
  result: RelatedCodexResult | null;
  backlinks?: Array<{ path: string; title: string }>;
}) {
  const relationships = result?.relationships ?? [];
  const backlinkCards = backlinks ?? [];
  return (
    <section className="relationship-inspector">
      <div className="study-section-heading">
        <h3>Relationship Inspector</h3>
        <strong>{relationships.length}</strong>
      </div>
      {relationships.length ? (
        <div>
          {relationships.slice(0, 12).map((relationship) => (
            <p
              key={`${relationship.from}-${relationship.kind}-${relationship.to}`}
            >
              <GitBranch size={13} />
              <span>{relationship.kind}</span>
              <strong>{relationship.to}</strong>
            </p>
          ))}
        </div>
      ) : (
        <p className="muted">Relationships appear after cards are committed.</p>
      )}
      <div className="study-section-heading relationship-backlinks-heading">
        <h3>Backlinks</h3>
        <strong>{backlinkCards.length}</strong>
      </div>
      {backlinkCards.map((card) => (
        <p key={card.path}>
          <GitBranch size={13} />
          <span>backlink</span>
          <strong>{card.title}</strong>
        </p>
      ))}
    </section>
  );
}
