"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Maximize2,
  Moon,
  Plus,
  Save,
  Search,
  SplitSquareHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { MarkdownView } from "@/components/reading/markdown-view";
import type { AiSuggestion } from "@/lib/ai/types";
import { expandSlashCommand, slashSnippets } from "@/lib/editor/slash";
import { countNoteBlocks } from "@/lib/projects/notes";
import type { SourceKind } from "@/lib/projects/sources";
import type { BookMetadata } from "@/lib/projects/templates";
import type { FileNode } from "@/lib/storage/types";

const MarkdownEditor = dynamic(
  () =>
    import("@/components/editor/markdown-editor").then(
      (mod) => mod.MarkdownEditor,
    ),
  { ssr: false },
);

type SaveState = "saved" | "dirty" | "saving";
type ViewMode = "write" | "preview" | "read";

interface LoadedFile {
  path: string;
  content: string;
  analysis: {
    outgoing: Array<{ target: string; alias?: string; raw: string }>;
    backlinks: Array<{ path: string }>;
    broken: Array<{ target: string; raw: string }>;
  };
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
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [splitPreview, setSplitPreview] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ path: string; snippet: string }>
  >([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [notesCaptureOpen, setNotesCaptureOpen] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("raw");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfKind, setPdfKind] = useState<SourceKind>("paper");
  const [captureStatus, setCaptureStatus] = useState("");
  const [notesCount, setNotesCount] = useState(0);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const activeBook = books.find((book) => book.id === bookId);

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

  useEffect(() => {
    if (!searchQuery || !bookId) {
      setSearchResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const response = await fetch(
        `/api/books/${bookId}/files?q=${encodeURIComponent(searchQuery)}`,
      );
      setSearchResults(await response.json());
    }, 180);
    return () => window.clearTimeout(handle);
  }, [bookId, searchQuery]);

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
      body: JSON.stringify({ source: sourceInput, kind: sourceKind }),
    });
    setSourceInput("");
    setCaptureStatus(
      sourceKind === "raw" ? "Source saved." : `Source saved as ${sourceKind}.`,
    );
    await loadFiles();
    if (openPath.startsWith("sources/")) await loadFile(openPath);
    window.setTimeout(() => setCaptureStatus(""), 1600);
  }

  async function uploadPdfSource() {
    if (!bookId || !pdfFile) return;
    const form = new FormData();
    form.append("file", pdfFile);
    form.append("kind", pdfKind);
    const response = await fetch(`/api/books/${bookId}/sources/upload`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      setCaptureStatus("PDF upload failed.");
      window.setTimeout(() => setCaptureStatus(""), 2200);
      return;
    }
    setPdfFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    setCaptureStatus(`PDF saved as ${pdfKind}.`);
    await loadFiles();
    if (openPath.startsWith("sources/")) await loadFile(openPath);
    window.setTimeout(() => setCaptureStatus(""), 1800);
  }

  async function archiveCurrentBook() {
    if (!bookId || !window.confirm("Archive this book?")) return;
    await fetch(`/api/books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    await loadBooks();
  }

  async function deleteCurrentBook() {
    if (!bookId || !window.confirm("Delete this book directory?")) return;
    await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    await loadBooks();
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
        focusMode ? "focus-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {viewMode !== "read" && !focusMode ? (
        <aside className="left-pane" aria-label="Files">
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

          <label className="search-box">
            <Search size={15} />
            <input
              placeholder="Search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          {searchResults.length ? (
            <div className="search-results">
              {searchResults.map((result) => (
                <button key={result.path} onClick={() => loadFile(result.path)}>
                  <strong>{result.path}</strong>
                  <span>{result.snippet}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="quick-actions">
            <button onClick={() => createNote("inbox")}>
              <FilePlus size={15} /> Note
            </button>
            <button onClick={() => createNote("concepts")}>
              <FolderPlus size={15} /> Concept
            </button>
          </div>

          <nav className="quick-links">
            <button className="notes-link" onClick={openCurrentNotes}>
              Notes
            </button>
            {[
              "main.md",
              "notes.md",
              "README.md",
              "sources/Books.md",
              "sources/Papers.md",
              "sources/Claims.md",
            ].map((path) => (
              <button key={path} onClick={() => loadFile(path)}>
                {path}
              </button>
            ))}
          </nav>

          <div className="file-tree">
            {files.map((node) => renderNode(node, bookId, loadFile))}
          </div>

          <div className="book-danger">
            <button onClick={archiveCurrentBook}>
              <Archive size={14} /> Archive
            </button>
            <button onClick={deleteCurrentBook}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </aside>
      ) : null}

      <section className="center-pane">
        <header className="topbar">
          <div>
            <strong>{activeBook?.title}</strong>
            <span>{openPath}</span>
          </div>
          <div className="toolbar">
            <span className={`save-state ${saveState}`}>{saveState}</span>
            <button title="Save" onClick={saveFile}>
              <Save size={16} />
            </button>
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
              title="Theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {viewMode === "read" ? (
          <MarkdownView markdown={draft} reading onWikiClick={openWikiTarget} />
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

      {viewMode !== "read" && !focusMode ? (
        <aside className="right-pane" aria-label="Input">
          <InputPane
            noteValue={noteInput}
            onNoteChange={setNoteInput}
            onNoteCommit={commitNote}
            noteTextareaRef={noteInputRef}
            sourceValue={sourceInput}
            sourceKind={sourceKind}
            pdfFile={pdfFile}
            pdfKind={pdfKind}
            pdfInputRef={pdfInputRef}
            onSourceChange={setSourceInput}
            onSourceKindChange={setSourceKind}
            onSourceCommit={commitSource}
            onPdfChange={setPdfFile}
            onPdfKindChange={setPdfKind}
            onPdfUpload={uploadPdfSource}
            notesCount={notesCount}
            hasCurrentNotes={hasCurrentNotes}
            onAi={askAi}
            onOpenCurrentNotes={openCurrentNotes}
          />
        </aside>
      ) : null}

      {viewMode !== "read" ? (
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
  sourceKind,
  pdfFile,
  pdfKind,
  pdfInputRef,
  onSourceChange,
  onSourceKindChange,
  onSourceCommit,
  onPdfChange,
  onPdfKindChange,
  onPdfUpload,
  notesCount,
  hasCurrentNotes,
  onAi,
  onOpenCurrentNotes,
}: {
  noteValue: string;
  onNoteChange: (value: string) => void;
  onNoteCommit: () => void;
  noteTextareaRef: RefObject<HTMLTextAreaElement | null>;
  sourceValue: string;
  sourceKind: SourceKind;
  pdfFile: File | null;
  pdfKind: SourceKind;
  pdfInputRef: RefObject<HTMLInputElement | null>;
  onSourceChange: (value: string) => void;
  onSourceKindChange: (value: SourceKind) => void;
  onSourceCommit: () => void;
  onPdfChange: (value: File | null) => void;
  onPdfKindChange: (value: SourceKind) => void;
  onPdfUpload: () => void;
  notesCount: number;
  hasCurrentNotes: boolean;
  onAi: (kind: string) => void;
  onOpenCurrentNotes: () => void;
}) {
  return (
    <div className="input-pane">
      <section className="notes-panel">
        <h2>Notes</h2>
        {hasCurrentNotes ? (
          <>
            <p className="notes-count">{notesCount}</p>
            <p className="muted">Notes waiting safely.</p>
            <button onClick={onOpenCurrentNotes}>Open Notes</button>
            <button onClick={() => onAi("reindex-inbox")}>
              Organize later
            </button>
          </>
        ) : (
          <>
            <p className="muted">No notes file yet.</p>
            <button onClick={onOpenCurrentNotes}>Create Notes</button>
          </>
        )}
      </section>
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
        <button onClick={onNoteCommit}>Submit Note</button>
        <p className="muted">Saved to notes.md</p>
      </section>
      <section className="source-capture-box">
        <p className="eyebrow">Sources</p>
        <textarea
          aria-label="Sources input"
          placeholder="Paste a link, citation, quote, or raw source."
          value={sourceValue}
          onChange={(event) => onSourceChange(event.target.value)}
        />
        <div className="source-actions">
          <select
            aria-label="Source type"
            value={sourceKind}
            onChange={(event) =>
              onSourceKindChange(event.target.value as SourceKind)
            }
          >
            <option value="raw">raw</option>
            <option value="book">book</option>
            <option value="paper">paper</option>
            <option value="article">article</option>
            <option value="quote">quote</option>
            <option value="claim">claim</option>
          </select>
          <button onClick={onSourceCommit}>Commit Source</button>
        </div>
        <p className="muted">Saved to sources/raw.md and mirrored by type.</p>
      </section>
      <section className="pdf-source-box">
        <p className="eyebrow">PDF source</p>
        <input
          ref={pdfInputRef}
          aria-label="PDF source file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => onPdfChange(event.target.files?.[0] ?? null)}
        />
        <div
          className="source-kind-pills"
          aria-label="PDF source type"
          role="radiogroup"
        >
          {(
            [
              "book",
              "paper",
              "article",
              "quote",
              "claim",
              "raw",
            ] satisfies SourceKind[]
          ).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={pdfKind === kind}
              className={pdfKind === kind ? "active" : ""}
              onClick={() => onPdfKindChange(kind)}
            >
              {kind}
            </button>
          ))}
        </div>
        <div className="pdf-upload-actions">
          <button onClick={onPdfUpload} disabled={!pdfFile}>
            Upload PDF
          </button>
        </div>
        {pdfFile ? <p className="muted">{pdfFile.name}</p> : null}
        <p className="muted">
          Stored under sources/files and indexed in Markdown.
        </p>
      </section>
      <section className="quiet-process">
        <h2>Later</h2>
        <button onClick={() => onAi("reindex-inbox")}>Organize notes</button>
      </section>
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
          <button onClick={onCommit}>Submit Note</button>
        </div>
      </section>
    </div>
  );
}

function renderNode(
  node: FileNode,
  bookId: string,
  loadFile: (path: string) => void,
) {
  const cleanPath = cleanProjectPath(node.path, bookId);
  if (node.kind === "directory") {
    return (
      <details key={node.path} open>
        <summary>
          <ChevronDown size={13} /> {node.name}
        </summary>
        {node.children?.map((child) => renderNode(child, bookId, loadFile))}
      </details>
    );
  }
  return (
    <button
      key={node.path}
      className="file-row"
      onClick={() => loadFile(cleanPath)}
    >
      {node.name}
    </button>
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
