"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { CSSProperties, Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  GitBranch,
  Maximize2,
  Moon,
  Plus,
  Save,
  SplitSquareHorizontal,
  Sun,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { MarkdownView } from "@/components/reading/markdown-view";
import type { AiSuggestion } from "@/lib/ai/types";
import { expandSlashCommand, slashSnippets } from "@/lib/editor/slash";
import { countNoteBlocks } from "@/lib/projects/notes";
import type { BookMetadata, ManuscriptSection } from "@/lib/projects/templates";
import type { FileNode } from "@/lib/storage/types";

const MarkdownEditor = dynamic(
  () =>
    import("@/components/editor/markdown-editor").then(
      (mod) => mod.MarkdownEditor,
    ),
  { ssr: false },
);

type SaveState = "saved" | "dirty" | "saving";
type ViewMode = "write" | "preview" | "read" | "study";

interface LoadedFile {
  path: string;
  content: string;
  analysis: {
    outgoing: Array<{ target: string; alias?: string; raw: string }>;
    backlinks: Array<{ path: string }>;
    broken: Array<{ target: string; raw: string }>;
  };
}

interface StudyInvestigation {
  query: string;
  title: string;
  summary: string;
  relatedConcepts: string[];
  sourceCoverage: {
    sources: number;
    chunks: number;
    files: number;
    scope: string;
  };
  directReferences: StudyPassage[];
  conceptualEchoes: string[];
  claims: StudyPassage[];
  relatedObjects: Array<{ path: string; title: string; excerpt: string }>;
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      kind: "concept" | "source" | "claim" | "object";
    }>;
    links: Array<{
      from: string;
      to: string;
      strength: "primary" | "secondary";
    }>;
  };
  auditLog: string[];
}

interface StudyPassage {
  id: string;
  quote: string;
  sourceFile: string;
  sourceType: string;
  page: string;
  confidence: "High" | "Medium" | "Low";
  retrievalMethod: string;
}

export function EssaiApp({
  initialBooks,
  initialBookId,
}: {
  initialBooks: BookMetadata[];
  initialBookId?: string;
}) {
  const [books, setBooks] = useState(initialBooks);
  const [bookId, setBookId] = useState(
    initialBookId ?? initialBooks[0]?.id ?? "",
  );
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openPath, setOpenPath] = useState("main.md");
  const [draft, setDraft] = useState("");
  const [, setSaveState] = useState<SaveState>("saved");
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [splitPreview, setSplitPreview] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [notesCaptureOpen, setNotesCaptureOpen] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [captureStatus, setCaptureStatus] = useState("");
  const [notesCount, setNotesCount] = useState(0);
  const [studyQuery, setStudyQuery] = useState("programmable machines");
  const [studyExhaustive, setStudyExhaustive] = useState(true);
  const [studySelectedSources, setStudySelectedSources] = useState<string[]>(
    [],
  );
  const [studyInvestigation, setStudyInvestigation] =
    useState<StudyInvestigation | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const activeBook = books.find((book) => book.id === bookId);
  const manuscriptSections = activeBook?.sections?.length
    ? activeBook.sections
    : [{ id: "main", title: "Main", path: "main.md" }];

  const loadBooks = useCallback(async () => {
    const response = await fetch("/api/books");
    const next = (await response.json()) as BookMetadata[];
    setBooks(next);
    if (!bookId && next[0]) setBookId(next[0].id);
  }, [bookId]);

  const loadFiles = useCallback(async () => {
    if (!bookId) return;
    const response = await fetch(`/api/books/${bookId}/files`);
    setFiles((await response.json()) as FileNode[]);
  }, [bookId]);

  const loadFile = useCallback(
    async (path: string) => {
      if (!bookId || !path) return;
      try {
        const response = await fetch(
          `/api/books/${bookId}/files/${encodeURIComponentPath(path)}`,
        );
        if (!response.ok) return;
        const file = (await response.json()) as LoadedFile;
        setDraft(file.content);
        setOpenPath(path);
        setSaveState("saved");
      } catch {
        // Route transitions can cancel in-flight file reads.
      }
    },
    [bookId],
  );

  const saveFile = useCallback(async () => {
    if (!bookId || !openPath) return;
    setSaveState("saving");
    await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(openPath)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      },
    );
    await loadFile(openPath);
    setSaveState("saved");
  }, [bookId, draft, loadFile, openPath]);

  useEffect(() => {
    if (!books.length) return;
    loadFiles();
  }, [books.length, loadFiles]);

  useEffect(() => {
    if (!bookId) return;
    loadFiles().then(() => loadFile(openPath));
  }, [bookId, loadFiles, loadFile, openPath]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const selected = window.getSelection()?.toString();
    if (!selected) return;
    setDraft((value) =>
      value.replace(selected, `${before}${selected}${after}`),
    );
    setSaveState("dirty");
  }, []);

  const focusNotes = useCallback(() => {
    if (noteInputRef.current && !focusMode && viewMode !== "read") {
      noteInputRef.current.focus();
      return;
    }
    setNotesCaptureOpen(true);
  }, [focusMode, viewMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        saveFile();
      }
      if (key === "k" || key === "p") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (key === "r") {
        event.preventDefault();
        setViewMode((mode) => (mode === "read" ? "write" : "read"));
      }
      if (key === ".") {
        event.preventDefault();
        setFocusMode((value) => !value);
      }
      if (key === "n" && event.shiftKey) {
        event.preventDefault();
        focusNotes();
      }
      if (key === "b") {
        event.preventDefault();
        wrapSelection("**", "**");
      }
      if (key === "i") {
        event.preventDefault();
        wrapSelection("*", "*");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusNotes, saveFile, wrapSelection]);

  const allFiles = useMemo(
    () => flattenNodes(files).filter((file) => file.kind === "file"),
    [files],
  );
  const hasCurrentNotes = allFiles.some((file) =>
    file.path.endsWith("/notes.md"),
  );
  const archiveFiles = allFiles
    .map((file) => cleanProjectPath(file.path, bookId))
    .filter((path) => path.startsWith("sources/"));
  const studySourceFiles = archiveFiles.filter((path) => path.endsWith(".md"));
  const objectFiles = allFiles
    .map((file) => cleanProjectPath(file.path, bookId))
    .filter((path) => path.startsWith("objects/") && path.endsWith(".md"));

  useEffect(() => {
    if (!bookId || !hasCurrentNotes) {
      setNotesCount(0);
      return;
    }
    fetch(`/api/books/${bookId}/files/${encodeURIComponentPath("notes.md")}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((file: LoadedFile | null) => {
        if (file) setNotesCount(countNoteBlocks(file.content));
      });
  }, [bookId, hasCurrentNotes, files]);

  useEffect(() => {
    if (!bookId || viewMode !== "study") return;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setStudyLoading(true);
      try {
        const params = new URLSearchParams({
          q: studyQuery,
          mode: studyExhaustive ? "exhaustive" : "fast",
        });
        studySelectedSources.forEach((path) => params.append("source", path));
        const response = await fetch(`/api/books/${bookId}/study?${params}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setStudyInvestigation((await response.json()) as StudyInvestigation);
        }
      } catch {
        // Typing a new inquiry cancels the previous archival pass.
      } finally {
        if (!controller.signal.aborted) setStudyLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [
    bookId,
    files,
    studyExhaustive,
    studyQuery,
    studySelectedSources,
    viewMode,
  ]);

  async function createNewBook(titleFromForm?: string) {
    const title = titleFromForm || window.prompt("Book title");
    if (!title) return;
    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const book = (await response.json()) as BookMetadata;
    await loadBooks();
    setBookId(book.id);
    setOpenPath("main.md");
    router.push(`/projects/${book.id}`);
  }

  async function createNote(folder = "inbox") {
    const name = window.prompt("Note name", "new-note.md");
    if (!name || !bookId) return;
    const path = `${folder}/${name.endsWith(".md") ? name : `${name}.md`}`;
    await fetch(`/api/books/${bookId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        content: `# ${name.replace(/\.md$/, "")}\n\n`,
      }),
    });
    await loadFiles();
    await loadFile(path);
  }

  async function openCurrentNotes() {
    if (!bookId) return;
    if (!hasCurrentNotes) {
      await fetch(`/api/books/${bookId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "notes.md",
          content:
            "# Notes\n\nFast captures live here until they are processed.\n\n",
        }),
      });
      await loadFiles();
    }
    await loadFile("notes.md");
  }

  async function commitNote() {
    if (!bookId || !noteInput.trim()) return;
    const response = await fetch(`/api/books/${bookId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteInput }),
    });
    const result = (await response.json()) as { count: number };
    setNotesCount(result.count);
    setNoteInput("");
    setCaptureStatus("Captured.");
    await loadFiles();
    if (openPath === "notes.md") {
      await loadFile(openPath);
    }
    if (notesCaptureOpen) setNotesCaptureOpen(false);
    window.requestAnimationFrame(() => noteInputRef.current?.focus());
    window.setTimeout(() => setCaptureStatus(""), 1600);
  }

  async function commitSource() {
    if (!bookId || !sourceInput.trim()) return;
    await fetch(`/api/books/${bookId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: sourceInput, kind: "raw" }),
    });
    setSourceInput("");
    setCaptureStatus("Source saved.");
    await loadFiles();
    if (openPath.startsWith("sources/")) await loadFile(openPath);
    window.setTimeout(() => setCaptureStatus(""), 1600);
  }

  async function uploadSourceFile(fileOverride?: File) {
    const file = fileOverride ?? pdfFile;
    if (!bookId || !file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "raw");
    try {
      const response = await fetch(`/api/books/${bookId}/sources/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setCaptureStatus(result?.error ?? "File upload failed.");
        window.setTimeout(() => setCaptureStatus(""), 2200);
        return;
      }
    } catch {
      setCaptureStatus("File upload failed. Check the dev server.");
      window.setTimeout(() => setCaptureStatus(""), 2200);
      return;
    }
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    setCaptureStatus("File saved.");
    await loadFiles();
    if (openPath.startsWith("sources/")) await loadFile(openPath);
    window.setTimeout(() => setCaptureStatus(""), 1800);
  }

  async function updateManuscriptSections(nextSections: ManuscriptSection[]) {
    if (!bookId) return;
    const response = await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: nextSections }),
    });
    if (!response.ok) return;
    const updated = (await response.json()) as BookMetadata;
    setBooks((current) =>
      current.map((book) => (book.id === updated.id ? updated : book)),
    );
  }

  function moveManuscriptSection(dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const result = moveSectionBefore(manuscriptSections, dragId, targetId);
    if (result) updateManuscriptSections(result);
  }

  async function askAi(kind: string) {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, path: openPath, content: draft }),
    });
    const result = (await response.json()) as { suggestions: AiSuggestion[] };
    setCaptureStatus(
      result.suggestions.length ? "Suggestions noted." : "Nothing to process.",
    );
    window.setTimeout(() => setCaptureStatus(""), 1600);
  }

  function onDraftChange(value: string) {
    setDraft(expandSlashCommand(value));
    setSaveState("dirty");
  }

  function openWikiTarget(target: string) {
    const normalized = target.toLowerCase().replace(/\.md$/, "");
    const found = allFiles.find(
      (file) =>
        file.path.toLowerCase().replace(/\.md$/, "") === normalized ||
        file.name.toLowerCase().replace(/\.md$/, "") === normalized,
    );
    if (found) loadFile(cleanProjectPath(found.path, bookId));
  }

  if (!books.length) {
    return (
      <main className="empty-state">
        <div>
          <p className="eyebrow">essai</p>
          <h1>A writing room for a book that has not yet begun.</h1>
          <p>
            Create a portable Markdown project with a human-only manuscript
            rule.
          </p>
          <form
            className="new-book-form"
            onSubmit={(event) => {
              event.preventDefault();
              createNewBook(newBookTitle);
            }}
          >
            <input
              aria-label="Book title"
              placeholder="Book title"
              value={newBookTitle}
              onChange={(event) => setNewBookTitle(event.target.value)}
            />
            <button type="submit">
              <Plus size={16} /> New book
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main
      className={[
        "app-frame",
        viewMode === "read" ? "reading-active" : "",
        viewMode === "study" ? "study-active" : "",
        focusMode ? "focus-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {viewMode === "study" && !focusMode ? (
        <StudySidebar
          archiveFiles={archiveFiles}
          sourceFiles={studySourceFiles}
          selectedSources={studySelectedSources}
          objectFiles={objectFiles}
          notesCount={notesCount}
          investigation={studyInvestigation}
          onOpenFile={(path) => {
            setViewMode("preview");
            loadFile(path);
          }}
          onStudyConcept={(concept) => {
            setStudyQuery(concept);
            setViewMode("study");
          }}
          onToggleSource={(path) =>
            setStudySelectedSources((selected) =>
              selected.includes(path)
                ? selected.filter((source) => source !== path)
                : [...selected, path],
            )
          }
          onClearSources={() => setStudySelectedSources([])}
        />
      ) : viewMode !== "read" && !focusMode ? (
        <aside className="left-pane" aria-label="Manuscript sections">
          <div className="brand-row">
            <div>
              <p className="eyebrow">essai</p>
              <select
                value={bookId}
                onChange={(event) => {
                  setBookId(event.target.value);
                  setOpenPath("main.md");
                  router.push(`/projects/${event.target.value}`);
                }}
              >
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.archived ? "[archived] " : ""}
                    {book.title}
                  </option>
                ))}
              </select>
            </div>
            <button title="New book" onClick={() => createNewBook()}>
              <Plus size={16} />
            </button>
          </div>
          <SectionTree
            sections={manuscriptSections}
            activePath={openPath}
            onOpen={loadFile}
            onMove={moveManuscriptSection}
          />
        </aside>
      ) : null}

      <section className="center-pane">
        <header className="topbar">
          <div>
            <strong>{activeBook?.title}</strong>
            <span>{viewMode === "study" ? "sources archive" : openPath}</span>
          </div>
          <div className="toolbar">
            {viewMode !== "study" ? (
              <>
                <button title="Save" onClick={saveFile}>
                  <Save size={16} />
                </button>
              </>
            ) : null}
            <div className="mode-switch" aria-label="Writing mode">
              <button
                className={viewMode === "write" ? "active" : ""}
                onClick={() => setViewMode("write")}
              >
                Write
              </button>
              <button
                className={viewMode === "preview" ? "active" : ""}
                onClick={() => setViewMode("preview")}
              >
                Preview
              </button>
              <button
                className={
                  viewMode === "read" ? "active read-mode" : "read-mode"
                }
                onClick={() => setViewMode("read")}
              >
                Read
              </button>
              <button
                className={
                  viewMode === "study" ? "active study-mode" : "study-mode"
                }
                onClick={() => setViewMode("study")}
              >
                Study
              </button>
            </div>
            {viewMode === "preview" ? (
              <button
                title="Split preview"
                onClick={() => setSplitPreview((value) => !value)}
              >
                <SplitSquareHorizontal size={16} />
              </button>
            ) : null}
            <button
              title="Focus mode"
              onClick={() => setFocusMode((value) => !value)}
            >
              <Maximize2 size={16} />
            </button>
            <button
              className="read-button"
              onClick={() =>
                setViewMode(viewMode === "read" ? "write" : "read")
              }
            >
              <BookOpen size={16} /> Read
            </button>
            <button
              aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {viewMode === "read" ? (
          <MarkdownView markdown={draft} reading onWikiClick={openWikiTarget} />
        ) : viewMode === "study" ? (
          <StudySurface
            query={studyQuery}
            exhaustive={studyExhaustive}
            selectedSources={studySelectedSources}
            loading={studyLoading}
            investigation={studyInvestigation}
            onQueryChange={setStudyQuery}
            onExhaustiveChange={setStudyExhaustive}
            onOpenFile={(path) => {
              setViewMode("preview");
              loadFile(path);
            }}
            onStudyConcept={setStudyQuery}
          />
        ) : (
          <div
            className={`workspace mode-${viewMode} ${splitPreview ? "with-split" : ""}`}
          >
            {viewMode === "write" || splitPreview ? (
              <MarkdownEditor value={draft} onChange={onDraftChange} />
            ) : null}
            {viewMode === "preview" ? (
              <MarkdownView markdown={draft} onWikiClick={openWikiTarget} />
            ) : null}
          </div>
        )}
      </section>

      {viewMode !== "read" && viewMode !== "study" && !focusMode ? (
        <aside className="right-pane" aria-label="Input">
          <InputPane
            noteValue={noteInput}
            onNoteChange={setNoteInput}
            onNoteCommit={commitNote}
            noteTextareaRef={noteInputRef}
            sourceValue={sourceInput}
            pdfFile={pdfFile}
            pdfInputRef={pdfInputRef}
            onSourceChange={setSourceInput}
            onSourceCommit={commitSource}
            onPdfChange={setPdfFile}
            onPdfUpload={uploadSourceFile}
            onPdfDrop={uploadSourceFile}
          />
        </aside>
      ) : null}

      {viewMode === "study" && !focusMode ? (
        <aside className="right-pane study-input-pane" aria-label="Input">
          <InputPane
            noteValue={noteInput}
            onNoteChange={setNoteInput}
            onNoteCommit={commitNote}
            noteTextareaRef={noteInputRef}
            sourceValue={sourceInput}
            pdfFile={pdfFile}
            pdfInputRef={pdfInputRef}
            onSourceChange={setSourceInput}
            onSourceCommit={commitSource}
            onPdfChange={setPdfFile}
            onPdfUpload={uploadSourceFile}
            onPdfDrop={uploadSourceFile}
          />
        </aside>
      ) : null}

      {viewMode !== "read" && viewMode !== "study" ? (
        <button className="floating-notes" onClick={focusNotes}>
          <Plus size={18} /> Notes
        </button>
      ) : null}

      {captureStatus ? (
        <div className="capture-toast">{captureStatus}</div>
      ) : null}

      {notesCaptureOpen ? (
        <NotesCaptureModal
          value={noteInput}
          onChange={setNoteInput}
          onClose={() => setNotesCaptureOpen(false)}
          onCommit={commitNote}
        />
      ) : null}

      {commandOpen ? (
        <CommandPalette
          files={allFiles}
          onClose={() => setCommandOpen(false)}
          onCommand={(command) => {
            setCommandOpen(false);
            if (command === "save") saveFile();
            if (command === "read") setViewMode("read");
            if (command === "write") setViewMode("write");
            if (command === "preview") setViewMode("preview");
            if (command === "study") setViewMode("study");
            if (command === "focus") setFocusMode((value) => !value);
            if (command === "focus-notes") focusNotes();
            if (command === "open-notes") openCurrentNotes();
            if (command === "new-note") createNote("inbox");
            if (command.startsWith("insert:"))
              insertSnippet(command.slice(7), setDraft, setSaveState);
            if (command === "reindex") askAi("reindex-inbox");
            if (command === "links") askAi("suggest-links");
            if (command === "claims") askAi("extract-claims");
            if (command === "readme") loadFile("README.md");
            if (command === "manuscript") loadFile("main.md");
            if (command.startsWith("file:")) loadFile(command.slice(5));
          }}
        />
      ) : null}
    </main>
  );
}

function InputPane({
  noteValue,
  onNoteChange,
  onNoteCommit,
  noteTextareaRef,
  sourceValue,
  pdfFile,
  pdfInputRef,
  onSourceChange,
  onSourceCommit,
  onPdfChange,
  onPdfUpload,
  onPdfDrop,
}: {
  noteValue: string;
  onNoteChange: (value: string) => void;
  onNoteCommit: () => void;
  noteTextareaRef: RefObject<HTMLTextAreaElement | null>;
  sourceValue: string;
  pdfFile: File | null;
  pdfInputRef: RefObject<HTMLInputElement | null>;
  onSourceChange: (value: string) => void;
  onSourceCommit: () => void;
  onPdfChange: (value: File | null) => void;
  onPdfUpload: () => void;
  onPdfDrop: (file: File) => void;
}) {
  return (
    <div className="input-pane">
      <section className="notes-capture-box">
        <p className="eyebrow">Notes</p>
        <textarea
          ref={noteTextareaRef}
          autoFocus
          aria-label="Notes input"
          placeholder="Write a note. Submit, clear, keep moving."
          value={noteValue}
          onChange={(event) => onNoteChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onNoteCommit();
            }
          }}
        />
        <button onClick={onNoteCommit}>Submit</button>
        <p className="muted">Saved to notes.md</p>
      </section>
      <section className="source-capture-box">
        <p className="eyebrow">Source</p>
        <div
          className="source-capture-target"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0] ?? null;
            onPdfChange(file);
            if (file) onPdfDrop(file);
          }}
        >
          <textarea
            aria-label="Sources input"
            placeholder="Paste a link, citation, quote, or raw source. Drop a file here too."
            value={sourceValue}
            onChange={(event) => onSourceChange(event.target.value)}
          />
          <div className="source-file-row">
            <input
              ref={pdfInputRef}
              aria-label="Source file"
              type="file"
              onChange={(event) => onPdfChange(event.target.files?.[0] ?? null)}
            />
            <span>{pdfFile ? pdfFile.name : "No file selected"}</span>
            <button type="button" onClick={() => pdfInputRef.current?.click()}>
              Choose File
            </button>
          </div>
        </div>
        <div className="source-actions">
          <button className="primary-action" onClick={onSourceCommit}>
            <Save size={15} /> Commit
          </button>
        </div>
        <div className="pdf-upload-actions">
          <button
            className="primary-action"
            onClick={() => onPdfUpload()}
            disabled={!pdfFile}
          >
            <Upload size={15} /> Upload File
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionTree({
  sections,
  activePath,
  onOpen,
  onMove,
}: {
  sections: ManuscriptSection[];
  activePath: string;
  onOpen: (path: string) => void;
  onMove: (dragId: string, targetId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  return (
    <nav className="section-tree" aria-label="Sections">
      <div className="section-tree-heading">
        <p className="eyebrow">Sections</p>
      </div>
      {sections.map((section) => (
        <SectionTreeItem
          key={section.id}
          section={section}
          activePath={activePath}
          draggingId={draggingId}
          depth={0}
          onOpen={onOpen}
          onMove={onMove}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
        />
      ))}
    </nav>
  );
}

function SectionTreeItem({
  section,
  activePath,
  draggingId,
  depth,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  section: ManuscriptSection;
  activePath: string;
  draggingId: string | null;
  depth: number;
  onOpen: (path: string) => void;
  onMove: (dragId: string, targetId: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="section-tree-node">
      <div
        className={[
          "section-row",
          activePath === section.path ? "active" : "",
          draggingId === section.id ? "dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--section-depth": depth } as CSSProperties}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const dragId = event.dataTransfer.getData("text/plain");
          if (dragId) onMove(dragId, section.id);
          onDragEnd();
        }}
      >
        <button
          type="button"
          draggable
          className="section-open-button"
          onClick={() => onOpen(section.path)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", section.id);
            onDragStart(section.id);
          }}
          onDragEnd={onDragEnd}
        >
          <span>{section.title}</span>
        </button>
      </div>
      {section.children?.length ? (
        <div className="section-tree-children">
          {section.children.map((child) => (
            <SectionTreeItem
              key={child.id}
              section={child}
              activePath={activePath}
              draggingId={draggingId}
              depth={depth + 1}
              onOpen={onOpen}
              onMove={onMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StudySidebar({
  archiveFiles,
  sourceFiles,
  selectedSources,
  objectFiles,
  notesCount,
  investigation,
  onOpenFile,
  onStudyConcept,
  onToggleSource,
  onClearSources,
}: {
  archiveFiles: string[];
  sourceFiles: string[];
  selectedSources: string[];
  objectFiles: string[];
  notesCount: number;
  investigation: StudyInvestigation | null;
  onOpenFile: (path: string) => void;
  onStudyConcept: (concept: string) => void;
  onToggleSource: (path: string) => void;
  onClearSources: () => void;
}) {
  const sourceCounts = {
    Books: archiveFiles.filter((path) => path.includes("Books.md")).length,
    Papers: archiveFiles.filter((path) => path.includes("Papers.md")).length,
    Articles: archiveFiles.filter((path) => path.includes("Articles.md"))
      .length,
    Quotes: archiveFiles.filter((path) => path.includes("Quotes.md")).length,
    Claims: archiveFiles.filter((path) => path.includes("Claims.md")).length,
    "Uploaded files": archiveFiles.filter((path) =>
      path.startsWith("sources/files/"),
    ).length,
  };
  return (
    <aside className="study-sidebar" aria-label="Study archive">
      <div>
        <p className="eyebrow">Study</p>
        <h2>Semantic Archive</h2>
      </div>
      <nav className="study-nav" aria-label="Archive navigation">
        {["Sources", "Concepts", "Objects", "Claims", "Notes"].map((item) => (
          <button key={item}>{item}</button>
        ))}
        <button>Semantic bookmarks</button>
        <button>Recent investigations</button>
      </nav>
      <section className="study-sidebar-section">
        <h3>Archive</h3>
        {Object.entries(sourceCounts).map(([label, count]) => (
          <button key={label} onClick={() => onOpenFile(sourcePathFor(label))}>
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </section>
      <section className="study-sidebar-section study-source-picker">
        <div className="study-section-heading">
          <h3>Study Sources</h3>
          <button type="button" onClick={onClearSources}>
            All
          </button>
        </div>
        {sourceFiles.map((path) => (
          <button
            key={path}
            type="button"
            className={selectedSources.includes(path) ? "selected" : ""}
            aria-pressed={selectedSources.includes(path)}
            onClick={() => onToggleSource(path)}
          >
            <span>{path.replace(/^sources\//, "")}</span>
          </button>
        ))}
      </section>
      <section className="study-sidebar-section">
        <h3>Objects</h3>
        {objectFiles.slice(0, 7).map((path) => (
          <button key={path} onClick={() => onOpenFile(path)}>
            {path.replace(/^objects\//, "")}
          </button>
        ))}
      </section>
      <section className="study-sidebar-section">
        <h3>Notes</h3>
        <button onClick={() => onOpenFile("notes.md")}>
          <span>Captured notes</span>
          <strong>{notesCount}</strong>
        </button>
      </section>
      {investigation?.conceptualEchoes.length ? (
        <section className="study-sidebar-section">
          <h3>Recent Inquiry</h3>
          {investigation.conceptualEchoes.slice(0, 5).map((echo) => (
            <button key={echo} onClick={() => onStudyConcept(echo)}>
              {echo}
            </button>
          ))}
        </section>
      ) : null}
    </aside>
  );
}

function StudySurface({
  query,
  exhaustive,
  selectedSources,
  loading,
  investigation,
  onQueryChange,
  onExhaustiveChange,
  onOpenFile,
  onStudyConcept,
}: {
  query: string;
  exhaustive: boolean;
  selectedSources: string[];
  loading: boolean;
  investigation: StudyInvestigation | null;
  onQueryChange: (value: string) => void;
  onExhaustiveChange: (value: boolean) => void;
  onOpenFile: (path: string) => void;
  onStudyConcept: (concept: string) => void;
}) {
  return (
    <div className="study-surface">
      <section className="study-inquiry">
        <label>
          <span>Search archive</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Study search"
            placeholder="Search concepts, sources, claims, and objects"
          />
        </label>
        <div className="study-audit-toggle" aria-label="Retrieval depth">
          <label>
            <input
              type="checkbox"
              checked={!exhaustive}
              onChange={() => onExhaustiveChange(false)}
            />
            <span>Fast Semantic Search</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={exhaustive}
              onChange={() => onExhaustiveChange(true)}
            />
            <span>Exhaustive Scholarly Audit</span>
          </label>
        </div>
      </section>

      <article className="study-scroll" aria-busy={loading}>
        <header className="concept-header">
          <p className="eyebrow">Concept</p>
          <h1>{investigation?.title ?? titleCase(query)}</h1>
          <p>{investigation?.summary ?? "Reading the source archive."}</p>
          <div className="concept-meta">
            <span>
              {investigation?.sourceCoverage.sources ?? 0} source indexes
            </span>
            <span>{investigation?.sourceCoverage.chunks ?? 0} chunks</span>
            <span>{investigation?.sourceCoverage.files ?? 0} files</span>
            <span>
              {selectedSources.length
                ? `${selectedSources.length} selected`
                : "all sources"}
            </span>
            <span>
              {investigation?.sourceCoverage.scope ?? "Preparing audit"}
            </span>
          </div>
          <div className="concept-tags">
            {(investigation?.relatedConcepts ?? []).map((concept) => (
              <button key={concept} onClick={() => onStudyConcept(concept)}>
                {concept}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <p className="study-loading">Accumulating source evidence.</p>
        ) : null}

        <StudyPassageSection
          title="Direct References"
          passages={investigation?.directReferences ?? []}
          empty="No high-confidence passages yet."
          onOpenFile={onOpenFile}
        />

        <section className="study-section">
          <h2>Conceptual Echoes</h2>
          <div className="echo-list">
            {(investigation?.conceptualEchoes ?? []).map((echo) => (
              <button key={echo} onClick={() => onStudyConcept(echo)}>
                {echo}
              </button>
            ))}
          </div>
        </section>

        <StudyPassageSection
          title="Claims"
          passages={investigation?.claims ?? []}
          empty="No related claims have been indexed in sources/Claims.md."
          onOpenFile={onOpenFile}
        />

        <section className="study-section">
          <h2>Related Objects</h2>
          <div className="object-ledger">
            {(investigation?.relatedObjects ?? []).length ? (
              investigation?.relatedObjects.map((object) => (
                <button
                  key={object.path}
                  onClick={() => onOpenFile(object.path)}
                >
                  <strong>{object.title}</strong>
                  <span>{object.path}</span>
                  <p>{object.excerpt}</p>
                </button>
              ))
            ) : (
              <p className="muted">No object records connected yet.</p>
            )}
          </div>
        </section>

        <section className="study-section">
          <h2>Source Graph</h2>
          <StudyGraph investigation={investigation} />
        </section>

        <section className="study-section audit-log">
          <h2>Coverage Log</h2>
          {(investigation?.auditLog ?? []).map((entry) => (
            <p key={entry}>{entry}</p>
          ))}
        </section>
      </article>
    </div>
  );
}

function StudyPassageSection({
  title,
  passages,
  empty,
  onOpenFile,
}: {
  title: string;
  passages: StudyPassage[];
  empty: string;
  onOpenFile: (path: string) => void;
}) {
  return (
    <section className="study-section">
      <h2>{title}</h2>
      <div className="passage-ledger">
        {passages.length ? (
          passages.map((passage) => (
            <button
              key={passage.id}
              onClick={() => onOpenFile(passage.sourceFile)}
            >
              <blockquote>{passage.quote}</blockquote>
              <dl>
                <div>
                  <dt>Source</dt>
                  <dd>{passage.sourceFile}</dd>
                </div>
                <div>
                  <dt>Page</dt>
                  <dd>{passage.page}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{passage.confidence}</dd>
                </div>
                <div>
                  <dt>Retrieval</dt>
                  <dd>{passage.retrievalMethod}</dd>
                </div>
              </dl>
            </button>
          ))
        ) : (
          <p className="muted">{empty}</p>
        )}
      </div>
    </section>
  );
}

function StudyGraph({
  investigation,
}: {
  investigation: StudyInvestigation | null;
}) {
  if (!investigation?.graph.nodes.length) {
    return <p className="muted">The graph will appear as sources connect.</p>;
  }
  return (
    <div className="source-graph">
      {investigation.graph.nodes.map((node, index) => (
        <div
          key={node.id}
          className={`graph-node ${node.kind}`}
          style={{ "--graph-index": index } as CSSProperties}
        >
          <GitBranch size={14} />
          <span>{node.label}</span>
        </div>
      ))}
      <div className="graph-relations">
        {investigation.graph.links.slice(0, 9).map((link, index) => (
          <span
            key={`${link.from}-${link.to}-${index}`}
            className={link.strength}
            style={
              {
                "--graph-link-index": index,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

function CommandPalette({
  files,
  onClose,
  onCommand,
}: {
  files: FileNode[];
  onClose: () => void;
  onCommand: (command: string) => void;
}) {
  const [query, setQuery] = useState("");
  const commands = [
    ["write", "Write mode"],
    ["preview", "Preview mode"],
    ["read", "Read mode"],
    ["study", "Study mode"],
    ["save", "Save"],
    ["focus-notes", "Focus Notes"],
    ["open-notes", "Open Notes"],
    ["focus", "Toggle focus mode"],
    ["new-note", "New note"],
    ["reindex", "Reindex inbox"],
    ["links", "Suggest links"],
    ["claims", "Extract claims"],
    ["insert:claim", "/claim"],
    ["insert:source", "/source"],
    ["insert:concept", "/concept"],
    ["insert:object", "/object"],
    ["insert:question", "/question"],
    ["readme", "Open README"],
    ["manuscript", "Open manuscript"],
    ...files.map((file) => [
      `file:${cleanProjectPath(file.path)}`,
      cleanProjectPath(file.path),
    ]),
  ];
  const filtered = commands
    .filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12);
  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          placeholder="Command or file"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div>
          {filtered.map(([command, label]) => (
            <button key={command} onClick={() => onCommand(command)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotesCaptureModal({
  value,
  onChange,
  onClose,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onCommit: () => void;
}) {
  return (
    <div className="notes-backdrop" onClick={onClose}>
      <section
        className="notes-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Notes</p>
        <textarea
          autoFocus
          aria-label="Quick note"
          placeholder="Write the note before it disappears."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (
              event.key === "Enter" &&
              (!event.shiftKey || event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              onCommit();
            }
          }}
        />
        <div className="notes-actions">
          <span>Enter captures. Shift+Enter makes a line.</span>
          <button onClick={onCommit}>Submit</button>
        </div>
      </section>
    </div>
  );
}

function flattenNodes(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.children ? flattenNodes(node.children) : []),
  ]);
}

function encodeURIComponentPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function cleanProjectPath(path: string, bookId?: string) {
  const scoped = bookId
    ? new RegExp(`^projects/${bookId}/`)
    : /^projects\/[^/]+\//;
  return path.replace(scoped, "");
}

function sourcePathFor(label: string) {
  return (
    {
      Books: "sources/Books.md",
      Papers: "sources/Papers.md",
      Articles: "sources/Articles.md",
      Quotes: "sources/Quotes.md",
      Claims: "sources/Claims.md",
      "Uploaded files": "sources/raw.md",
    }[label] ?? "sources/raw.md"
  );
}

function moveSectionBefore(
  sections: ManuscriptSection[],
  dragId: string,
  targetId: string,
) {
  const { sections: withoutDragged, section } = removeSection(sections, dragId);
  if (!section) return null;
  const inserted = insertSectionBefore(withoutDragged, targetId, section);
  return inserted ?? sections;
}

function removeSection(
  sections: ManuscriptSection[],
  id: string,
): { sections: ManuscriptSection[]; section: ManuscriptSection | null } {
  let removed: ManuscriptSection | null = null;
  const next = sections.flatMap((section) => {
    if (section.id === id) {
      removed = section;
      return [];
    }
    const childResult = removeSection(section.children ?? [], id);
    if (childResult.section) {
      removed = childResult.section;
      return [{ ...section, children: childResult.sections }];
    }
    return [section];
  });
  return { sections: next, section: removed };
}

function insertSectionBefore(
  sections: ManuscriptSection[],
  targetId: string,
  sectionToInsert: ManuscriptSection,
): ManuscriptSection[] | null {
  const targetIndex = sections.findIndex((section) => section.id === targetId);
  if (targetIndex !== -1) {
    return [
      ...sections.slice(0, targetIndex),
      sectionToInsert,
      ...sections.slice(targetIndex),
    ];
  }
  for (const section of sections) {
    const children = insertSectionBefore(
      section.children ?? [],
      targetId,
      sectionToInsert,
    );
    if (children) {
      return sections.map((item) =>
        item.id === section.id ? { ...item, children } : item,
      );
    }
  }
  return null;
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function insertSnippet(
  command: string,
  setDraft: Dispatch<SetStateAction<string>>,
  setSaveState: Dispatch<SetStateAction<SaveState>>,
) {
  const snippet = slashSnippets[command];
  if (!snippet) return;
  setDraft((value) => `${value.trimEnd()}\n\n${snippet}`);
  setSaveState("dirty");
}
