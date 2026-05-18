"use client";

import type { PdfResolvedMatch } from "@/lib/pdf/pdfMatchResolver";
import type { PdfRect } from "@/lib/pdf/pdfTextMap";

export function PdfHighlightLayer({
  page,
  pageSize,
  matches,
  activeMatchId,
  debug = false,
  runBoxes = [],
}: {
  page: number;
  pageSize: { width: number; height: number };
  matches: PdfResolvedMatch[];
  activeMatchId?: string;
  debug?: boolean;
  runBoxes?: PdfRect[];
}) {
  const boxes = matches.flatMap((match) =>
    match.boxes.map((box) => ({
      ...box,
      active: activeMatchId ? box.matchId === activeMatchId : match.id === matches[0]?.id,
    })),
  );

  return (
    // This layer renders geometry boxes only; text matching has already been
    // resolved through canonical PDF.js page reconstruction.
    <div
      className="pdf-highlight-layer"
      data-page={page}
      style={{
        width: `${pageSize.width}px`,
        height: `${pageSize.height}px`,
      }}
      aria-hidden
    >
      {debug
        ? runBoxes.map((box, index) => (
            <span
              key={`run-${index}`}
              className="pdf-highlight-run-debug"
              style={boxStyle(box)}
            />
          ))
        : null}
      {boxes.map((box, index) => (
        <span
          key={`${box.matchId}-${box.runId}-${index}`}
          className={
            box.active
              ? "pdf-highlight-box active"
              : "pdf-highlight-box inactive"
          }
          data-match-id={box.matchId}
          style={boxStyle(box)}
        />
      ))}
    </div>
  );
}

function boxStyle(box: PdfRect) {
  return {
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
}
