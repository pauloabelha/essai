"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import * as pdfjs from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfStudyReader({
  url,
  title,
  targetPage,
  targetQuote,
}: {
  url: string;
  title: string;
  targetPage: number | null;
  targetQuote?: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const [scale, setScale] = useState(1.15);
  const [status, setStatus] = useState("Opening source");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const task = pdfjs.getDocument(url);
    setPdf(null);
    setPageCount(0);
    setCurrentPage(1);
    setStatus("Opening source");
    void task.promise
      .then((document) => {
        if (cancelled) {
          void document.destroy();
          return;
        }
        setPdf(document);
        setPageCount(document.numPages);
        setStatus("");
      })
      .catch(() => {
        if (!cancelled) setStatus("Could not open this PDF.");
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url]);

  const pageNumbers = useMemo(
    () => Array.from({ length: pageCount }, (_, index) => index + 1),
    [pageCount],
  );

  const goToPage = (page: number, behavior: ScrollBehavior = "smooth") => {
    if (!pageCount) return;
    const nextPage = clampPage(page, pageCount);
    setRequestedPage(nextPage);
    setCurrentPage(nextPage);
    requestAnimationFrame(() => {
      document
        .getElementById(pdfPageElementId(nextPage))
        ?.scrollIntoView({ block: "start", behavior });
    });
  };

  useEffect(() => {
    if (!targetPage || !pageCount) return;
    goToPage(targetPage);
    // goToPage reads refs and state; target changes are the command boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPage, pageCount]);

  return (
    <div className="pdf-study-reader" aria-label={title}>
      <div className="pdf-study-toolbar">
        <div>
          <strong>{title}</strong>
          <span>
            {status ||
              `Page ${currentPage.toLocaleString()} of ${pageCount.toLocaleString()}`}
          </span>
        </div>
        <div className="pdf-study-controls">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!pageCount || currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <input
            aria-label="PDF page"
            inputMode="numeric"
            value={currentPage}
            disabled={!pageCount}
            onChange={(event) => {
              const value = Number(event.target.value.replace(/\D/g, ""));
              if (value) setCurrentPage(clampPage(value, pageCount));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                goToPage(currentPage);
              }
            }}
          />
          <button
            type="button"
            aria-label="Next page"
            disabled={!pageCount || currentPage >= pageCount}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setScale((value) => Math.max(0.72, value - 0.12))}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setScale((value) => Math.min(2.2, value + 0.12))}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="pdf-study-pages">
        {pdf
          ? pageNumbers.map((pageNumber) => (
              <PdfStudyPage
                key={`${pageNumber}-${scale}`}
                pdf={pdf}
                pageNumber={pageNumber}
                scale={scale}
                active={pageNumber === requestedPage}
                targetQuote={pageNumber === requestedPage ? targetQuote : ""}
                onVisible={setCurrentPage}
              />
            ))
          : null}
        {status ? <p className="muted">{status}</p> : null}
      </div>
    </div>
  );
}

function PdfStudyPage({
  pdf,
  pageNumber,
  scale,
  active,
  targetQuote,
  onVisible,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  active: boolean;
  targetQuote?: string;
  onVisible: (pageNumber: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [textItems, setTextItems] = useState<PdfTextItem[]>([]);
  const [pageSize, setPageSize] = useState({ width: 760, height: 1040 });

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          onVisible(pageNumber);
        }
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [onVisible, pageNumber]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    void pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      setPageSize({ width: viewport.width, height: viewport.height });
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const textContent = await page.getTextContent({
        includeMarkedContent: false,
      });
      setTextItems(
        textContent.items.flatMap((item) =>
          "str" in item && item.str.trim()
            ? [
                {
                  str: item.str,
                  transform: item.transform as number[],
                  width: item.width,
                  height: item.height,
                  fontName: item.fontName,
                },
              ]
            : [],
        ),
      );

      renderTask = page.render({
        canvasContext: context,
        viewport,
        transform:
          pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      await renderTask.promise;
      if (!cancelled) setRendered(true);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, scale, visible]);

  useEffect(() => {
    if (!active || !textLayerRef.current) return;
    const mark = textLayerRef.current.querySelector("[data-pdf-match='true']");
    mark?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active, textItems, targetQuote]);

  const highlightRange = useMemo(
    () => findPdfHighlightRange(textItems, targetQuote ?? ""),
    [textItems, targetQuote],
  );

  return (
    <figure
      id={pdfPageElementId(pageNumber)}
      ref={wrapperRef}
      className={active ? "pdf-study-page active" : "pdf-study-page"}
      style={
        {
          "--pdf-page-width": `${pageSize.width}px`,
          "--pdf-page-height": `${pageSize.height}px`,
        } as CSSProperties
      }
    >
      <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} />
      {rendered && textItems.length ? (
        <div ref={textLayerRef} className="pdf-study-text-layer" aria-hidden>
          {textItems.map((item, index) => (
            <PdfTextRun
              key={`${index}-${item.str}`}
              item={item}
              index={index}
              scale={scale}
              highlightRange={highlightRange}
            />
          ))}
        </div>
      ) : null}
      {!rendered ? <div className="pdf-study-placeholder" /> : null}
      <figcaption>p. {pageNumber}</figcaption>
    </figure>
  );
}

function PdfTextRun({
  item,
  index,
  scale,
  highlightRange,
}: {
  item: PdfTextItem;
  index: number;
  scale: number;
  highlightRange: PdfHighlightRange | null;
}) {
  const transform = item.transform;
  const highlighted = Boolean(
    highlightRange &&
    index >= highlightRange.start &&
    index <= highlightRange.end,
  );
  return (
    <span
      data-pdf-match={highlighted ? "true" : undefined}
      className={
        highlighted ? "pdf-study-text-run match" : "pdf-study-text-run"
      }
      style={{
        left: `${transform[4] * scale}px`,
        top: `${transform[5] * scale}px`,
        fontSize: `${Math.max(1, Math.hypot(transform[2], transform[3]) * scale)}px`,
        transform: `scaleX(${item.width ? item.width / Math.max(item.str.length, 1) / Math.max(Math.hypot(transform[0], transform[1]), 1) : 1})`,
      }}
    >
      {item.str}
    </span>
  );
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

interface PdfHighlightRange {
  start: number;
  end: number;
}

function clampPage(page: number, pageCount: number) {
  return Math.max(1, Math.min(pageCount, Math.round(page)));
}

function pdfPageElementId(pageNumber: number) {
  return `study-pdf-page-${pageNumber}`;
}

function findPdfHighlightRange(
  items: PdfTextItem[],
  quote: string,
): PdfHighlightRange | null {
  const queryTerms = tokenizeForHighlight(quote).filter(
    (term) => term.length > 3,
  );
  if (!items.length || !queryTerms.length) return null;

  const itemTerms = items.map((item) => tokenizeForHighlight(item.str));
  let best: { start: number; end: number; score: number } | null = null;

  for (let start = 0; start < itemTerms.length; start += 1) {
    const seen = new Set<string>();
    for (
      let end = start;
      end < Math.min(itemTerms.length, start + 18);
      end += 1
    ) {
      for (const term of itemTerms[end]) {
        if (queryTerms.includes(term)) seen.add(term);
      }
      const score = seen.size;
      if (score > (best?.score ?? 0)) best = { start, end, score };
      if (score >= Math.min(queryTerms.length, 5)) break;
    }
  }

  if (!best || best.score < Math.min(2, queryTerms.length)) return null;
  return { start: best.start, end: best.end };
}

function tokenizeForHighlight(value: string) {
  return value
    .replace(/\.\.\./g, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
