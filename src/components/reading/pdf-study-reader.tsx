"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import * as pdfjs from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PdfHighlightLayer } from "@/components/study/PdfHighlightLayer";
import { resolvePdfMatches } from "@/lib/pdf/pdfMatchResolver";
import {
  reconstructPdfPage,
  type ReconstructedPdfPage,
} from "@/lib/pdf/pdfTextMap";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfStudyReader({
  url,
  title,
  targetKey,
  targetPage,
  targetQuote,
  targetQuery,
  targetTerms,
}: {
  url: string;
  title: string;
  targetKey?: string;
  targetPage: number | null;
  targetQuote?: string;
  targetQuery?: string;
  targetTerms?: string[];
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{
    page: number;
    behavior: ScrollBehavior;
    key: number;
  } | null>(null);
  const [scale, setScale] = useState(1.15);
  const [status, setStatus] = useState("Opening source");
  const scrollRequestSerial = useRef(0);
  const [pageCache] = useState(() => new Map<string, ReconstructedPdfPage>());
  const fingerprint = useMemo(() => pdfFingerprint(pdf, url), [pdf, url]);

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
    () => visiblePdfPages(pageCount, requestedPage ?? currentPage),
    [currentPage, pageCount, requestedPage],
  );

  const goToPage = (page: number, behavior: ScrollBehavior = "smooth") => {
    if (!pageCount) return;
    const nextPage = clampPage(page, pageCount);
    setRequestedPage(nextPage);
    setCurrentPage(nextPage);
    scrollRequestSerial.current += 1;
    setScrollRequest({
      page: nextPage,
      behavior,
      key: scrollRequestSerial.current,
    });
  };

  useEffect(() => {
    if (!scrollRequest || !pageNumbers.includes(scrollRequest.page)) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(pdfPageElementId(scrollRequest.page))
        ?.scrollIntoView({ block: "start", behavior: scrollRequest.behavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pageNumbers, scrollRequest]);

  useEffect(() => {
    if (!targetPage || !pageCount) return;
    goToPage(targetPage);
    // goToPage reads refs and state; target changes are the command boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, targetPage, pageCount]);

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
                targetQuery={pageNumber === requestedPage ? targetQuery : ""}
                targetTerms={pageNumber === requestedPage ? targetTerms : []}
                cache={pageCache}
                fingerprint={fingerprint}
                cacheScope={url}
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
  targetQuery,
  targetTerms,
  cache,
  fingerprint,
  cacheScope,
  onVisible,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  active: boolean;
  targetQuote?: string;
  targetQuery?: string;
  targetTerms?: string[];
  cache: Map<string, ReconstructedPdfPage>;
  fingerprint: string;
  cacheScope: string;
  onVisible: (pageNumber: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const highlightLayerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [reconstructedPage, setReconstructedPage] =
    useState<ReconstructedPdfPage | null>(null);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 760, height: 1040 });
  const debug = process.env.NEXT_PUBLIC_PDF_HIGHLIGHT_DEBUG === "true";

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (entry.intersectionRatio >= 0.45) {
            onVisible(pageNumber);
          }
        }
      },
      { rootMargin: "1200px 0px", threshold: [0, 0.45] },
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
      const cacheKey = pdfPageCacheKey({
        cacheScope,
        page: pageNumber,
        scale: viewport.scale,
        rotation: viewport.rotation,
        fingerprint,
      });
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
      const cached = cache.get(cacheKey);
      const reconstructed =
        cached ??
        reconstructPdfPage({
          page: pageNumber,
          items: textContent.items.flatMap((item) =>
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
          viewport: {
            width: viewport.width,
            height: viewport.height,
            scale: viewport.scale,
            rotation: viewport.rotation,
            transform: viewport.transform,
          },
          fingerprint,
        });
      if (!cached) cache.set(cacheKey, reconstructed);
      setReconstructedPage(reconstructed);

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
  }, [cache, cacheScope, fingerprint, pdf, pageNumber, scale, visible]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [targetQuote, targetQuery, targetTerms]);

  const resolvedMatches = useMemo(
    () =>
      reconstructedPage
        ? resolvePdfMatches(reconstructedPage, {
            quote: targetQuote,
            query: targetQuery,
            terms: targetTerms,
          })
        : [],
    [reconstructedPage, targetQuery, targetQuote, targetTerms],
  );
  const activeMatch =
    resolvedMatches[Math.min(activeMatchIndex, resolvedMatches.length - 1)];

  useEffect(() => {
    if (!active || !highlightLayerRef.current) return;
    const mark = highlightLayerRef.current.querySelector(".pdf-highlight-box.active");
    mark?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active, activeMatch?.id, resolvedMatches.length]);

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
      <div className="pdf-study-sheet" ref={highlightLayerRef}>
        <canvas ref={canvasRef} aria-label={`Page ${pageNumber}`} />
        {rendered && reconstructedPage ? (
          <PdfHighlightLayer
            page={pageNumber}
            pageSize={pageSize}
            matches={resolvedMatches}
            activeMatchId={activeMatch?.id}
            debug={debug}
            runBoxes={reconstructedPage.runs.map((run) => run.bboxViewport)}
          />
        ) : null}
        {rendered && reconstructedPage && !reconstructedPage.rawText ? (
          <p className="pdf-study-unsearchable">No extractable page text.</p>
        ) : null}
      </div>
      {active && resolvedMatches.length > 1 ? (
        <div className="pdf-match-controls">
          <button
            type="button"
            aria-label="Previous match"
            onClick={() =>
              setActiveMatchIndex((index) =>
                index <= 0 ? resolvedMatches.length - 1 : index - 1,
              )
            }
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {activeMatchIndex + 1} / {resolvedMatches.length}
          </span>
          <button
            type="button"
            aria-label="Next match"
            onClick={() =>
              setActiveMatchIndex((index) => (index + 1) % resolvedMatches.length)
            }
          >
            <ChevronRight size={14} />
          </button>
        </div>
      ) : null}
      {debug && reconstructedPage ? (
        <pre className="pdf-highlight-debug">
          {JSON.stringify(
            {
              page: reconstructedPage.page,
              rawText: reconstructedPage.rawText.slice(0, 900),
              matches: resolvedMatches.map((match) => match.range),
            },
            null,
            2,
          )}
        </pre>
      ) : null}
      {!rendered ? <div className="pdf-study-placeholder" /> : null}
      <figcaption>p. {pageNumber}</figcaption>
    </figure>
  );
}

function clampPage(page: number, pageCount: number) {
  return Math.max(1, Math.min(pageCount, Math.round(page)));
}

function visiblePdfPages(pageCount: number, anchorPage: number) {
  if (!pageCount) return [];
  const anchor = clampPage(anchorPage, pageCount);
  const pages = new Set<number>();
  for (
    let page = Math.max(1, anchor - 3);
    page <= Math.min(pageCount, anchor + 3);
    page += 1
  ) {
    pages.add(page);
  }
  pages.add(1);
  pages.add(pageCount);
  return [...pages].sort((a, b) => a - b);
}

function pdfPageElementId(pageNumber: number) {
  return `study-pdf-page-${pageNumber}`;
}

function pdfFingerprint(pdf: PDFDocumentProxy | null, fallback: string) {
  return (
    (pdf as unknown as { fingerprints?: string[] } | null)?.fingerprints?.[0] ??
    fallback
  );
}

function pdfPageCacheKey({
  cacheScope,
  page,
  scale,
  rotation,
  fingerprint,
}: {
  cacheScope: string;
  page: number;
  scale: number;
  rotation: number;
  fingerprint: string;
}) {
  return `${cacheScope}:${fingerprint}:${page}:${scale}:${rotation}`;
}
