# PDF Search Highlighting

Essai’s PDF reader highlights native PDF text through canonical PDF.js page geometry.

The invariant is:

```txt
Search highlighting must always flow through canonical page text and PDF.js geometry.
```

## Why The Old Highlighting Was Removed

The old reader searched rendered text spans with substring checks. That was fragile because the server search text, browser text spans, and PDF canvas geometry could disagree. A typo search such as `machien` could find a passage, then the reader might glow unrelated terms or oversized text runs.

The new flow separates broad retrieval from exact page resolution:

```txt
MiniSearch server result
→ source PDF + page
→ PDF.js page text extraction
→ canonical page text reconstruction
→ normalized exact-string search
→ character range match
→ PDF.js text-run geometry mapping
→ viewport-scaled highlight rectangles
→ stable overlay rendering
```

## Result Ordering

The server still uses MiniSearch for broad retrieval, then deduplicates adjacent PDF chunks from the same uploaded page. Direct references are sorted by source path and numeric page before they are shown in Study mode, with stronger matches used only as a tie-breaker on the same page. This keeps PDF search results in reading order instead of bouncing around by score.

## Canonical Page Reconstruction

For each visible or targeted native-text PDF page, the browser calls `getTextContent()` through PDF.js. Essai preserves text item order, reconstructs a raw page string, creates a normalized page string, and records every run’s raw and normalized character offsets.

Normalization uses:

- Unicode NFKC
- lowercase
- whitespace collapse
- soft hyphen removal
- optional punctuation-insensitive handling in the mapper

Normalization never replaces the raw text as the source of geometry. The normalized-to-raw offset map keeps every normalized match mappable back to original PDF text runs.

## Geometry Mapping

Each PDF.js text item becomes a `PdfTextRun` with:

- raw text and normalized text
- raw and normalized character offsets
- PDF-space bounding box
- viewport-space bounding box
- original PDF transform

A match character range is converted into boxes by finding intersecting runs. If a match starts or ends inside a run, Essai computes a partial box by character proportion. Multi-line matches produce separate boxes.

## Rendering Flow

`PdfHighlightLayer` renders absolute-position boxes above the PDF canvas. The boxes are not DOM text spans and are not discovered through browser selection. Active and inactive matches have separate classes, and next/previous match controls switch the active box without re-running document search.

## Cache Behavior

Reconstructed pages are cached in the reader by:

```txt
pdfPath + fingerprint + page + scale + rotation
```

Essai only reconstructs visible or targeted pages in the existing small page window. The browser does not parse the whole PDF for every query, and the server MiniSearch index remains responsible for broad retrieval.

## Debugging

Set:

```bash
NEXT_PUBLIC_PDF_HIGHLIGHT_DEBUG=true npm run dev
```

When enabled, the reader shows run boxes, reconstructed text previews, and resolved match ranges. Normal users do not see this UI.

## Known Limitations

- Native-text PDFs only.
- No OCR.
- No scanned PDF support.
- No AI, embeddings, reranking, or semantic search.
- Partial-run boxes use character-proportional width when PDF.js does not expose per-character geometry.
