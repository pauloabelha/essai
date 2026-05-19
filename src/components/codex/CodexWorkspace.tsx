"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  FileText,
  Save,
  Send,
  User,
} from "lucide-react";
import type { ResearchCard as ResearchCardModel } from "@/lib/codex/cards";
import type { RelatedCodexResult } from "@/lib/codex/relationships";
import type { ManuscriptSection } from "@/lib/projects/templates";
import type { FileNode } from "@/lib/storage/types";

export interface CodexSeed {
  quote: string;
  sourcePath: string;
  page?: string;
  retrievalMethod?: string;
  originatingQuery?: string;
}

interface CodexResponse {
  cards: ResearchCardModel[];
  related: RelatedCodexResult;
  backlinks: ResearchCardModel[];
}

interface ProjectSearchResult {
  path: string;
  score: number;
  snippet: string;
}

interface StudySearchSummary {
  sourceCoverage?: {
    matches: number;
    chunks: number;
    exactMatches: number;
    lexicalMatches: number;
    scope: string;
  };
  directReferences: Array<{
    quote: string;
    sourceFile: string;
    page: string;
    confidence: string;
    retrievalMethod: string;
  }>;
}

interface CodexMessage {
  id: string;
  role: "user" | "codex";
  content: string;
  status?: "thinking" | "done";
}

interface CodexHistoryFile {
  version: 1;
  createdAt: string;
  updatedAt: string;
  messages: CodexMessage[];
}

interface CodexCliResponse {
  output?: string;
  notesAppend?: string;
  error?: string;
}

interface CodexCliRequest {
  message: string;
  notes: string;
  selectedSources: string[];
  instructions: string;
  history: Array<{ role: string; content: string }>;
}

const NOTES_PATH = "codex/notes.md";
const HISTORY_ROOT = "codex/history";
const DEFAULT_CODEX_INSTRUCTIONS =
  "Read manuscript sections and sources freely, but never edit human-written section files. Keep notes source-grounded and append only to Codex notes when asked.";

export function CodexWorkspace({
  bookId,
  sources,
  chapters,
  seed,
  onOpenSource,
  onOpenChapter,
}: {
  bookId: string;
  sources: string[];
  chapters: ManuscriptSection[];
  seed: CodexSeed | null;
  onOpenSource: (path: string) => void;
  onOpenChapter: (path: string) => void;
}) {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sourceAccessedAt, setSourceAccessedAt] = useState<Record<string, number>>(
    {},
  );
  const [codexInstructions, setCodexInstructions] = useState(
    DEFAULT_CODEX_INSTRUCTIONS,
  );
  const [notes, setNotes] = useState("");
  const [notesStatus, setNotesStatus] = useState("Loading notes.");
  const [messages, setMessages] = useState<CodexMessage[]>([
    {
      id: "opening",
      role: "codex",
      content:
        "Codex is ready. Select a source, write Markdown notes, and ask for relationships, backlinks, claims, concepts, or source links.",
      status: "done",
    },
  ]);
  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [historyPath, setHistoryPath] = useState("");
  const [historyStatus, setHistoryStatus] = useState("History loading.");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [response, setResponse] = useState<CodexResponse | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<CodexMessage[]>(messages);
  const chapterOptions = useMemo(() => flattenSections(chapters), [chapters]);
  const sortedSources = useMemo(
    () =>
      [...sources].sort((a, b) => {
        const recent = (sourceAccessedAt[b] ?? 0) - (sourceAccessedAt[a] ?? 0);
        return recent || sourceLabel(a).localeCompare(sourceLabel(b));
      }),
    [sources, sourceAccessedAt],
  );

  const loadCodex = useCallback(
    async (query = "", target = "") => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (target) params.set("target", target);
      const result = (await (
        await fetch(`/api/books/${bookId}/codex?${params}`)
      ).json()) as CodexResponse;
      setResponse(result);
      return result;
    },
    [bookId],
  );

  const loadNotes = useCallback(async () => {
    const response = await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(NOTES_PATH)}`,
    );
    if (response.ok) {
      const file = (await response.json()) as { content: string };
      setNotes(file.content);
      setNotesStatus(`${NOTES_PATH} loaded.`);
      return;
    }
    const initial = "# Codex Notes\n\n";
    await fetch(`/api/books/${bookId}/files/${encodeURIComponentPath(NOTES_PATH)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: initial }),
    });
    setNotes(initial);
    setNotesStatus(`${NOTES_PATH} created.`);
  }, [bookId]);

  const listHistoryFiles = useCallback(async () => {
    const response = await fetch(`/api/books/${bookId}/files`);
    if (!response.ok) return [];
    const nodes = (await response.json()) as FileNode[];
    return flattenFileNodes(nodes)
      .map((file) => cleanBookPath(file.path, bookId))
      .filter(
        (path) => path.startsWith(`${HISTORY_ROOT}/`) && path.endsWith(".json"),
      )
      .sort();
  }, [bookId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoaded(false);
    const savedPath = window.localStorage.getItem(codexHistoryKey(bookId)) ?? "";
    const existing = await listHistoryFiles();
    const path =
      (savedPath && existing.includes(savedPath) ? savedPath : existing.at(-1)) ??
      createHistoryPath();
    setHistoryPath(path);
    window.localStorage.setItem(codexHistoryKey(bookId), path);

    const response = await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(path)}`,
    );
    if (response.ok) {
      const file = (await response.json()) as { content: string };
      const history = parseHistoryFile(file.content);
      if (history?.messages.length) {
        setMessages(history.messages);
        setHistoryStatus(`History loaded from ${path}.`);
      } else {
        setHistoryStatus(`History ready at ${path}.`);
      }
    } else {
      setHistoryStatus(`History ready at ${path}.`);
    }
    setHistoryLoaded(true);
  }, [bookId, listHistoryFiles]);

  const saveHistory = useCallback(
    async (nextMessages: CodexMessage[]) => {
      const now = new Date().toISOString();
      const history: CodexHistoryFile = {
        version: 1,
        createdAt: historyPathTimestamp(historyPath) ?? now,
        updatedAt: now,
        messages: nextMessages.map((message) => ({
          ...message,
          status: message.status === "thinking" ? "done" : message.status,
        })),
      };
      await fetch(
        `/api/books/${bookId}/files/${encodeURIComponentPath(historyPath)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `${JSON.stringify(history, null, 2)}\n`,
          }),
        },
      );
      setHistoryStatus(`History saved to ${historyPath}.`);
    },
    [bookId, historyPath],
  );

  useEffect(() => {
    try {
      setSourceAccessedAt(
        JSON.parse(
          window.localStorage.getItem(codexSourceAccessKey(bookId)) ?? "{}",
        ) as Record<string, number>,
      );
    } catch {
      setSourceAccessedAt({});
    }
  }, [bookId]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(codexInstructionsKey(bookId));
      setCodexInstructions(saved || DEFAULT_CODEX_INSTRUCTIONS);
    } catch {
      setCodexInstructions(DEFAULT_CODEX_INSTRUCTIONS);
    }
  }, [bookId]);

  useEffect(() => {
    window.localStorage.setItem(
      codexSourceAccessKey(bookId),
      JSON.stringify(sourceAccessedAt),
    );
  }, [bookId, sourceAccessedAt]);

  useEffect(() => {
    window.localStorage.setItem(codexInstructionsKey(bookId), codexInstructions);
  }, [bookId, codexInstructions]);

  useEffect(() => {
    if (!bookId) return;
    void loadHistory();
    void loadNotes();
    void loadCodex();
  }, [bookId, loadCodex, loadHistory, loadNotes]);

  useEffect(() => {
    messagesRef.current = messages;
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!bookId || !historyLoaded || !historyPath) return;
    const timeout = window.setTimeout(() => {
      void saveHistory(messages);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [bookId, historyLoaded, historyPath, messages, saveHistory]);

  useEffect(() => {
    if (!seed) return;
    selectSource(seed.sourcePath, true);
    setNotes((value) => {
      const entry = [
        value.trimEnd(),
        "",
        `## Source excerpt`,
        "",
        `Source: ${seed.sourcePath}${seed.page ? ` p. ${seed.page}` : ""}`,
        `Retrieval: ${seed.retrievalMethod ?? "Study selection"}`,
        seed.originatingQuery ? `Query: ${seed.originatingQuery}` : "",
        "",
        `> ${seed.quote}`,
        "",
      ]
        .filter((line, index) => line || index < 2)
        .join("\n");
      return entry.trimStart();
    });
    appendCodexMessage(
      `Study sent an excerpt from ${sourceLabel(seed.sourcePath)}. I staged it in the Markdown notes with provenance.`,
    );
  }, [seed]);

  async function saveNotes() {
    await fetch(`/api/books/${bookId}/files/${encodeURIComponentPath(NOTES_PATH)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: notes }),
    });
    setNotesStatus(`${NOTES_PATH} saved.`);
  }

  async function copyMessage(message: CodexMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    window.setTimeout(() => {
      setCopiedMessageId((current) => (current === message.id ? "" : current));
    }, 1400);
  }

  function selectSource(path: string, selected?: boolean) {
    setSelectedSources((current) => {
      const shouldSelect = selected ?? !current.includes(path);
      if (shouldSelect) return [...new Set([...current, path])];
      return current.filter((source) => source !== path);
    });
    setSourceAccessedAt((current) => ({ ...current, [path]: Date.now() }));
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    const userMessage: CodexMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };
    const thinkingId = `codex-${Date.now()}`;
    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: thinkingId,
        role: "codex",
        content: "Sending this to the local Codex CLI.",
        status: "thinking",
      },
    ]);

    try {
      const output = await codexReply(content, thinkingId);
      setMessages((current) =>
        current.map((message) =>
          message.id === thinkingId
            ? { ...message, content: output, status: "done" }
            : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === thinkingId
            ? {
                ...message,
                content:
                  error instanceof Error
                    ? error.message
                    : "Codex CLI proxy failed.",
                status: "done",
              }
            : message,
        ),
      );
    }
  }

  async function codexReply(message: string, messageId: string) {
    const [command, ...rest] = message.split(/\s+/);
    const value = rest.join(" ").trim();
    if (command === "/related") {
      const result = await loadCodex(value);
      return summarizeRelated(value, result);
    }
    if (command === "/backlinks") {
      const result = await loadCodex("", value);
      return result.backlinks.length
        ? `Backlinks for ${value}:\n${result.backlinks
            .map((card) => `- ${card.title} (${card.path})`)
            .join("\n")}`
        : `No committed Codex backlinks for ${value} yet.`;
    }
    if (command === "/source-links") {
      const source = value || selectedSources[0];
      if (!source) return "Select a source or provide a source path.";
      const result = await loadCodex(source);
      return summarizeRelated(source, result);
    }
    if (command === "/search") {
      if (!value) return "Give me a Study search query.";
      const result = await searchStudyIndex(value);
      if (!result.directReferences.length) {
        return `No indexed Study passages matched "${value}".`;
      }
      return summarizeStudySearch(value, result);
    }
    if (command === "/open-source") {
      const source = value || selectedSources[0];
      if (!source) return "Select a source first.";
      onOpenSource(source);
      return `Opening ${source} in Study.`;
    }
    if (command === "/open-chapter") {
      const chapter = value || chapterOptions[0]?.path;
      if (!chapter) return "No manuscript chapter is available.";
      onOpenChapter(chapter);
      return `Opening ${chapter}.`;
    }
    if (command === "/help") {
      return [
        "Available Codex commands:",
        "- /related <term>",
        "- /search <term>",
        "- /backlinks <path-or-concept>",
        "- /source-links <source-path>",
        "- /append-note <markdown>",
        "- /source-note <markdown>",
        "- /search-project <query>",
        "- /read <project-file-path>",
        "- /examine-section <section-path>",
        "- /commit-notes",
        "- /open-source <source-path>",
        "- /open-chapter <chapter-path>",
        "",
        "Any other message is sent through the local Codex CLI proxy.",
        "I can read project files, including manuscript sections and sources. My writes are limited to the Codex Markdown notes shown in the center panel.",
      ].join("\n");
    }
    if (command === "/append-note") {
      if (!value) return "Give me Markdown to append to the center notes.";
      appendToNotes(`\n\n${value}\n`);
      return "I appended that Markdown to the Codex notes in the center panel.";
    }
    if (command === "/source-note") {
      if (!value) return "Give me text to attach to the active source.";
      const sourceLine = selectedSources.length
        ? `Sources: ${selectedSources.join(", ")}`
        : "Source: unsourced";
      appendToNotes(`\n\n## Codex note\n\n${sourceLine}\n\n${value}\n`);
      return "I added a source-aware note to the center Markdown file.";
    }
    if (command === "/commit-notes") {
      await saveNotes();
      return `Committed the center Markdown notes to ${NOTES_PATH}.`;
    }
    if (command === "/search-project") {
      if (!value) return "Give me a project search query.";
      const results = await searchProject(value);
      if (!results.length) return `No project files matched "${value}".`;
      return [
        `Project search for "${value}":`,
        ...results
          .slice(0, 8)
          .map((result) => `- ${result.path} (${result.score}): ${result.snippet}`),
      ].join("\n");
    }
    if (command === "/read" || command === "/examine-section") {
      if (!value) return "Give me a project file path to read.";
      const file = await readProjectFile(value);
      if (!file) return `I could not read ${value}.`;
      return [
        `${command === "/examine-section" ? "Section" : "File"}: ${value}`,
        "Read-only access. I will not edit this file.",
        "",
        excerpt(file.content),
      ].join("\n");
    }

    return callCodexCli(message, messageId);
  }

  async function callCodexCli(message: string, messageId: string) {
    const response = await fetch(`/api/books/${bookId}/codex/cli?stream=1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        notes,
        selectedSources,
        instructions: codexInstructions,
        history: messagesRef.current.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
      } satisfies CodexCliRequest),
    });
    if (!response.ok || !response.body) {
      const result = (await response.json().catch(() => null)) as
        | CodexCliResponse
        | null;
      return result?.error ?? "Codex CLI proxy failed.";
    }
    return readCodexStream(response.body, messageId);
  }

  async function readCodexStream(
    body: ReadableStream<Uint8Array>,
    messageId: string,
  ) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamed = "";
    let finalOutput = "";
    let notesAppend = "";

    const consume = (chunk: string) => {
      buffer += chunk;
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const eventText of events) {
        const event = parseServerSentEvent(eventText);
        if (!event) continue;
        if (event.name === "delta") {
          const data = event.data as { delta?: string };
          const delta = data.delta ?? "";
          streamed += delta;
          updateStreamingMessage(messageId, streamed || "Codex is thinking.");
        }
        if (event.name === "status") {
          const data = event.data as { status?: string };
          if (!streamed) {
            updateStreamingMessage(
              messageId,
              codexStatusText(data.status ?? "working"),
            );
          }
        }
        if (event.name === "done") {
          const data = event.data as CodexCliResponse;
          finalOutput = data.output?.trim() ?? streamed.trim();
          notesAppend = data.notesAppend ?? "";
          updateStreamingMessage(
            messageId,
            finalOutput || streamed.trim() || "Codex finished.",
          );
        }
        if (event.name === "error") {
          const data = event.data as { error?: string };
          finalOutput = data.error ?? "Codex CLI proxy failed.";
          updateStreamingMessage(messageId, finalOutput);
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (value) consume(decoder.decode(value, { stream: !done }));
      if (done) break;
    }
    consume(decoder.decode());

    if (notesAppend) appendToNotes(`\n\n${notesAppend}\n`);
    return finalOutput || streamed.trim() || "Codex CLI returned no visible output.";
  }

  function updateStreamingMessage(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content }
          : message,
      ),
    );
  }

  async function searchProject(query: string) {
    const response = await fetch(
      `/api/books/${bookId}/files?q=${encodeURIComponent(query)}`,
    );
    if (!response.ok) return [];
    return (await response.json()) as ProjectSearchResult[];
  }

  async function readProjectFile(path: string) {
    const response = await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(path)}`,
    );
    if (!response.ok) return null;
    return (await response.json()) as { content: string };
  }

  async function searchStudyIndex(query: string) {
    const params = new URLSearchParams({ q: query, mode: "fast" });
    for (const source of selectedSources) params.append("source", source);
    const response = await fetch(`/api/books/${bookId}/study?${params}`);
    if (!response.ok) {
      return { directReferences: [] } as StudySearchSummary;
    }
    return (await response.json()) as StudySearchSummary;
  }

  function appendToNotes(markdown: string) {
    setNotes((current) => `${current.trimEnd()}${markdown}`);
    setNotesStatus(`${NOTES_PATH} edited by Codex.`);
  }

  function appendCodexMessage(content: string) {
    setMessages((current) => [
      ...current,
      {
        id: `codex-${Date.now()}`,
        role: "codex",
        content,
        status: "done",
      },
    ]);
  }

  return (
    <div className="codex-workspace">
      <aside className="codex-source-panel" aria-label="Codex sources">
        <section className="codex-source-panel-top">
          <header>
            <p className="eyebrow">Sources</p>
            <h2>Archive</h2>
            <p>
              {selectedSources.length || "No"} selected. Sorted by last access.
            </p>
          </header>
          <div className="codex-source-list">
            {sortedSources.map((source) => (
              <button
                key={source}
                type="button"
                className={selectedSources.includes(source) ? "selected" : ""}
                aria-pressed={selectedSources.includes(source)}
                onClick={() => selectSource(source)}
              >
                <FileText size={14} />
                <span>{sourceLabel(source)}</span>
                <em>{sourceAccessedAt[source] ? "recent" : "unread"}</em>
              </button>
            ))}
          </div>
        </section>
        <section className="codex-instructions-panel">
          <header>
            <p className="eyebrow">Instructions</p>
            <h2>Always Apply</h2>
          </header>
          <textarea
            aria-label="Codex persistent instructions"
            value={codexInstructions}
            onChange={(event) => setCodexInstructions(event.target.value)}
          />
        </section>
      </aside>

      <section className="codex-notes-panel">
        <header>
          <div>
            <p className="eyebrow">Markdown Notes</p>
            <h1>{NOTES_PATH}</h1>
            <p>{notesStatus}</p>
          </div>
          <div>
            {selectedSources.length === 1 ? (
              <button type="button" onClick={() => onOpenSource(selectedSources[0])}>
                <BookOpen size={15} /> Open Source
              </button>
            ) : null}
            <button type="button" onClick={() => void saveNotes()}>
              <Save size={15} /> Save
            </button>
          </div>
        </header>
        <textarea
          aria-label="Codex Markdown notes"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setNotesStatus(`${NOTES_PATH} edited.`);
          }}
          spellCheck
        />
      </section>

      <aside className="codex-chat-panel" aria-label="Codex messages">
        <header>
          <p className="eyebrow">Codex</p>
          <h2>Panel</h2>
          <p>{response?.cards.length ?? 0} committed cards indexed.</p>
          <p>{selectedSources.length || "No"} active source selections.</p>
          <p>{historyStatus}</p>
          <p>Proxy: local Codex CLI. Read access: project files. Write access: {NOTES_PATH} only.</p>
        </header>
        <div className="codex-message-list">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`codex-message ${message.role} ${message.status ?? ""}`}
            >
              <span>{message.role === "user" ? <User size={14} /> : <Bot size={14} />}</span>
              <div className="codex-message-body">
                <button
                  type="button"
                  aria-label={`Copy ${message.role} message`}
                  title="Copy message"
                  onClick={() => void copyMessage(message)}
                >
                  {copiedMessageId === message.id ? (
                    <Check size={13} />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
                <pre>{message.content}</pre>
              </div>
            </article>
          ))}
          <div ref={messageEndRef} />
        </div>
        <form
          className="codex-message-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <textarea
            aria-label="Codex message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="/related programmable behavior"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button type="submit" aria-label="Send Codex message">
            <Send size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function summarizeRelated(query: string, result: CodexResponse) {
  const cards = result.related.cards;
  const relationships = result.related.relationships;
  if (!cards.length && !relationships.length) {
    return `No committed Codex relationships for ${query || "that query"} yet. Keep taking Markdown notes, then promote durable links when ready.`;
  }
  return [
    `Related to ${query || "current Codex scope"}:`,
    ...cards.slice(0, 6).map((card) => `- ${card.title} (${card.type})`),
    relationships.length ? "" : "",
    relationships.length ? "Relationships:" : "",
    ...relationships
      .slice(0, 8)
      .map((relationship) => `- ${relationship.kind}: ${relationship.to}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeStudySearch(query: string, result: StudySearchSummary) {
  const coverage = result.sourceCoverage;
  return [
    `Study search for "${query}":`,
    coverage
      ? `${coverage.matches} matches across ${coverage.chunks} indexed chunks (${coverage.exactMatches} exact, ${coverage.lexicalMatches} lexical).`
      : "",
    ...result.directReferences.slice(0, 6).map((reference, index) =>
      [
        "",
        `${index + 1}. ${reference.sourceFile}${reference.page ? ` p. ${reference.page}` : ""} (${reference.confidence}, ${reference.retrievalMethod})`,
        `> ${reference.quote}`,
      ].join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function flattenSections(sections: ManuscriptSection[]): ManuscriptSection[] {
  return sections.flatMap((section) => [
    section,
    ...flattenSections(section.children ?? []),
  ]);
}

function sourceLabel(path: string) {
  return path.startsWith("sources/files/")
    ? (path.split("/").at(-1) ?? path)
    : path.replace(/^sources\//, "");
}

function codexSourceAccessKey(bookId: string) {
  return `essai:${bookId}:codex-source-access`;
}

function codexInstructionsKey(bookId: string) {
  return `essai:${bookId}:codex-instructions`;
}

function codexHistoryKey(bookId: string) {
  return `essai:${bookId}:codex-history`;
}

function codexStatusText(status: string) {
  if (status === "connected") return "Codex bridge connected.";
  if (status === "queued") return "Codex turn queued on the warm CLI bridge.";
  if (status === "started") return "Codex started. Waiting for the first token.";
  return `Codex ${status}.`;
}

function encodeURIComponentPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function createHistoryPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${HISTORY_ROOT}/${stamp}.json`;
}

function historyPathTimestamp(path: string) {
  const stamp = path.split("/").at(-1)?.replace(/\.json$/, "");
  if (!stamp) return null;
  const iso = stamp.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1T$2:$3:$4.$5Z",
  );
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function parseHistoryFile(content: string): CodexHistoryFile | null {
  try {
    const parsed = JSON.parse(content) as Partial<CodexHistoryFile>;
    if (parsed.version !== 1 || !Array.isArray(parsed.messages)) return null;
    return {
      version: 1,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      messages: parsed.messages.filter(isCodexMessage),
    };
  } catch {
    return null;
  }
}

function isCodexMessage(message: unknown): message is CodexMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Partial<CodexMessage>;
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "codex") &&
    typeof record.content === "string"
  );
}

function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.kind === "directory" && node.children
      ? flattenFileNodes(node.children)
      : []),
  ]);
}

function cleanBookPath(path: string, bookId: string) {
  return path.replace(new RegExp(`^projects/${escapeRegExp(bookId)}/`), "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excerpt(content: string) {
  const clean = content.trim();
  if (clean.length <= 1400) return clean || "(empty file)";
  return `${clean.slice(0, 1400).trimEnd()}\n\n...`;
}

function parseServerSentEvent(eventText: string) {
  const name =
    eventText
      .split("\n")
      .find((line) => line.startsWith("event: "))
      ?.slice(7)
      .trim() || "message";
  const dataText = eventText
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .join("\n");
  if (!dataText) return null;
  try {
    return { name, data: JSON.parse(dataText) as unknown };
  } catch {
    return null;
  }
}
