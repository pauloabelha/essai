"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Copy,
  FileText,
  Search,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
  User,
} from "lucide-react";
import type { ResearchCard as ResearchCardModel } from "@/lib/codex/cards";
import {
  buildCodexMagicPrompt,
  type CodexMagicAction,
} from "@/lib/codex/magic-prompts";
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

interface CodexHistorySummary {
  path: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

interface CodexCliResponse {
  output?: string;
  workspaceAppend?: string;
  workspaceReplace?: string;
  notesAppend?: string;
  error?: string;
}

interface CodexCliRequest {
  message: string;
  workspace: string;
  selectedSources: string[];
  instructions: string;
  history: Array<{ role: string; content: string }>;
}

const WORKSPACE_PATH = "codex/workspace.md";
const LEGACY_NOTES_PATH = "codex/notes.md";
const HISTORY_ROOT = "codex/history";
const DEFAULT_CODEX_INSTRUCTIONS =
  "Read manuscript sections and sources freely, but never edit human-written section files. Keep workspace changes source-grounded and preserve human edits in the center Codex workspace.";
const MAGIC_ACTIONS: Array<{
  id: CodexMagicAction;
  title: string;
  description: string;
  icon: typeof Search;
}> = [
  {
    id: "search-sources",
    title: "Search in sources",
    description: "Ask Codex to inspect selected source scope.",
    icon: Search,
  },
  {
    id: "check-accuracy",
    title: "Check accuracy",
    description: "Compare manuscript sections against archive evidence.",
    icon: ShieldCheck,
  },
  {
    id: "check-prose",
    title: "Check prose",
    description: "Read selected sections for clarity and structure.",
    icon: Wand2,
  },
];

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
  const [sourceAccessedAt, setSourceAccessedAt] = useState<
    Record<string, number>
  >({});
  const [codexInstructions, setCodexInstructions] = useState(
    DEFAULT_CODEX_INSTRUCTIONS,
  );
  const [activeMagicAction, setActiveMagicAction] =
    useState<CodexMagicAction | null>(null);
  const [magicQuery, setMagicQuery] = useState("");
  const [magicSources, setMagicSources] = useState<string[]>([]);
  const [magicSections, setMagicSections] = useState<string[]>([]);
  const [scopePaneWidth, setScopePaneWidth] = useState(310);
  const [chatPaneWidth, setChatPaneWidth] = useState(360);
  const [workspace, setWorkspace] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState("Loading workspace.");
  const [messages, setMessages] = useState<CodexMessage[]>([
    {
      id: "opening",
      role: "codex",
      content:
        "Codex is ready. Use the center Markdown workspace for shared inquiry; ask for relationships, backlinks, claims, concepts, or source links.",
      status: "done",
    },
  ]);
  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [historyPath, setHistoryPath] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyView, setHistoryView] = useState<"chat" | "history">("chat");
  const [historyItems, setHistoryItems] = useState<CodexHistorySummary[]>([]);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<CodexMessage[]>(messages);
  const chapterOptions = useMemo(() => flattenSections(chapters), [chapters]);
  const sectionPaths = useMemo(
    () => [...new Set(chapterOptions.map((section) => section.path))],
    [chapterOptions],
  );
  const sectionTitlesByPath = useMemo(
    () =>
      new Map(
        chapterOptions.map((section) => [
          section.path,
          section.title || section.path,
        ]),
      ),
    [chapterOptions],
  );
  const sortedSources = useMemo(
    () =>
      [...sources].sort((a, b) => {
        const recent = (sourceAccessedAt[b] ?? 0) - (sourceAccessedAt[a] ?? 0);
        return recent || sourceLabel(a).localeCompare(sourceLabel(b));
      }),
    [sources, sourceAccessedAt],
  );

  useEffect(() => {
    setScopePaneWidth(
      readStoredNumber("essai:pane:codex-scope", 310, 230, 520),
    );
    setChatPaneWidth(readStoredNumber("essai:pane:codex-chat", 360, 280, 560));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "essai:pane:codex-scope",
      String(scopePaneWidth),
    );
  }, [scopePaneWidth]);

  useEffect(() => {
    window.localStorage.setItem("essai:pane:codex-chat", String(chatPaneWidth));
  }, [chatPaneWidth]);

  const startCodexPaneResize = useCallback(
    (side: "left" | "right", event: ReactPointerEvent<HTMLButtonElement>) => {
      const startX = event.clientX;
      const startScope = scopePaneWidth;
      const startChat = chatPaneWidth;
      startHorizontalDrag(event, (clientX) => {
        if (side === "left") {
          setScopePaneWidth(clamp(startScope + clientX - startX, 220, 520));
          return;
        }
        setChatPaneWidth(clamp(startChat + startX - clientX, 260, 620));
      });
    },
    [chatPaneWidth, scopePaneWidth],
  );

  const loadCodex = useCallback(
    async (query = "", target = "") => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (target) params.set("target", target);
      const result = (await (
        await fetch(`/api/books/${bookId}/codex?${params}`)
      ).json()) as CodexResponse;
      return result;
    },
    [bookId],
  );

  const loadWorkspace = useCallback(async () => {
    const response = await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(WORKSPACE_PATH)}`,
    );
    if (response.ok) {
      const file = (await response.json()) as { content: string };
      setWorkspace(file.content);
      setWorkspaceStatus(`${WORKSPACE_PATH} loaded.`);
      return;
    }

    const legacyResponse = await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(LEGACY_NOTES_PATH)}`,
    );
    const initial = legacyResponse.ok
      ? ((await legacyResponse.json()) as { content: string }).content
      : "# Codex Workspace\n\n";
    await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(WORKSPACE_PATH)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: initial }),
      },
    );
    setWorkspace(initial);
    setWorkspaceStatus(
      legacyResponse.ok
        ? `${WORKSPACE_PATH} created from legacy notes.`
        : `${WORKSPACE_PATH} created.`,
    );
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

  const readHistory = useCallback(
    async (path: string) => {
      const response = await fetch(
        `/api/books/${bookId}/files/${encodeURIComponentPath(path)}`,
      );
      if (!response.ok) return null;
      const file = (await response.json()) as { content: string };
      return parseHistoryFile(file.content);
    },
    [bookId],
  );

  const loadHistorySummaries = useCallback(
    async (paths: string[]) => {
      const summaries = await Promise.all(
        paths.map(async (path) => {
          const history = await readHistory(path);
          return history ? summarizeHistory(path, history) : null;
        }),
      );
      return summaries
        .filter((item): item is CodexHistorySummary => Boolean(item))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    [readHistory],
  );

  useEffect(() => {
    setMagicSources(sources);
  }, [sources]);

  useEffect(() => {
    setMagicSections(sectionPaths);
  }, [sectionPaths]);

  const loadHistory = useCallback(async () => {
    setHistoryLoaded(false);
    const savedPath =
      window.localStorage.getItem(codexHistoryKey(bookId)) ?? "";
    const existing = await listHistoryFiles();
    setHistoryItems(await loadHistorySummaries(existing));
    const path =
      (savedPath && existing.includes(savedPath)
        ? savedPath
        : existing.at(-1)) ?? createHistoryPath();
    setHistoryPath(path);
    window.localStorage.setItem(codexHistoryKey(bookId), path);

    const history = await readHistory(path);
    if (history?.messages.length) {
      setMessages(history.messages);
    }
    setHistoryLoaded(true);
  }, [bookId, listHistoryFiles, loadHistorySummaries, readHistory]);

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
      setHistoryItems((current) =>
        upsertHistorySummary(current, historyPath, history),
      );
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
    window.localStorage.setItem(
      codexInstructionsKey(bookId),
      codexInstructions,
    );
  }, [bookId, codexInstructions]);

  useEffect(() => {
    if (!bookId) return;
    void loadHistory();
    void loadWorkspace();
    void loadCodex();
  }, [bookId, loadCodex, loadHistory, loadWorkspace]);

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
    setWorkspace((value) => {
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
      `Study sent an excerpt from ${sourceLabel(seed.sourcePath)}. I staged it in the Markdown workspace with provenance.`,
    );
  }, [seed]);

  async function saveWorkspace() {
    await fetch(
      `/api/books/${bookId}/files/${encodeURIComponentPath(WORKSPACE_PATH)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: workspace }),
      },
    );
    setWorkspaceStatus(`${WORKSPACE_PATH} saved.`);
  }

  async function copyMessage(message: CodexMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    window.setTimeout(() => {
      setCopiedMessageId((current) => (current === message.id ? "" : current));
    }, 1400);
  }

  async function openHistoryList() {
    const paths = await listHistoryFiles();
    setHistoryItems(await loadHistorySummaries(paths));
    setHistoryView("history");
  }

  async function openHistoryChat(path: string) {
    const history = await readHistory(path);
    if (!history) return;
    setHistoryPath(path);
    window.localStorage.setItem(codexHistoryKey(bookId), path);
    setMessages(history.messages);
    setHistoryLoaded(true);
    setHistoryView("chat");
  }

  function selectSource(path: string, selected?: boolean) {
    setSelectedSources((current) => {
      const shouldSelect = selected ?? !current.includes(path);
      if (shouldSelect) return [...new Set([...current, path])];
      return current.filter((source) => source !== path);
    });
    setSourceAccessedAt((current) => ({ ...current, [path]: Date.now() }));
  }

  function toggleMagicSource(path: string) {
    setMagicSources((current) =>
      current.includes(path)
        ? current.filter((source) => source !== path)
        : [...current, path],
    );
    setSourceAccessedAt((current) => ({ ...current, [path]: Date.now() }));
  }

  function toggleMagicSection(path: string) {
    setMagicSections((current) =>
      current.includes(path)
        ? current.filter((section) => section !== path)
        : [...current, path],
    );
  }

  async function sendMessage(message?: {
    content: string;
    displayContent?: string;
  }) {
    const content = (message?.content ?? input).trim();
    if (!content) return;
    const displayContent = (message?.displayContent ?? content).trim();
    if (!message) setInput("");
    const userMessage: CodexMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: displayContent,
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

  async function runMagicAction() {
    if (!activeMagicAction) return;
    const isSourceSearch = activeMagicAction === "search-sources";
    const sourcesForPrompt = isSourceSearch ? magicSources : sources;
    const sectionsForPrompt = isSourceSearch ? [] : magicSections;
    const prompt = buildCodexMagicPrompt(activeMagicAction, {
      query: magicQuery,
      sources: sourcesForPrompt,
      sections: sectionsForPrompt,
    });
    setSelectedSources(sourcesForPrompt);
    const action = MAGIC_ACTIONS.find((item) => item.id === activeMagicAction);
    const label =
      activeMagicAction === "search-sources"
        ? `${action?.title ?? "Search in sources"}: ${magicQuery || "all sources"}`
        : `${action?.title ?? "Codex magic"} (${magicSectionLabel(sectionsForPrompt, sectionTitlesByPath)})`;
    setActiveMagicAction(null);
    await sendMessage({ content: prompt, displayContent: `Magic: ${label}` });
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
        "- /append-workspace <markdown>",
        "- /source-note <markdown>",
        "- /search-project <query>",
        "- /read <project-file-path>",
        "- /examine-section <section-path>",
        "- /commit-workspace",
        "- /commit-notes",
        "- /open-source <source-path>",
        "- /open-chapter <chapter-path>",
        "",
        "Any other message is sent through the local Codex CLI proxy.",
        "I can read project files, including manuscript sections and sources. My writes are limited to the Codex Markdown workspace shown in the center panel.",
      ].join("\n");
    }
    if (command === "/append-note" || command === "/append-workspace") {
      if (!value) return "Give me Markdown to append to the center workspace.";
      appendToWorkspace(`\n\n${value}\n`);
      return "I appended that Markdown to the Codex workspace in the center panel.";
    }
    if (command === "/source-note") {
      if (!value) return "Give me text to attach to the active source.";
      const sourceLine = selectedSources.length
        ? `Sources: ${selectedSources.join(", ")}`
        : "Source: unsourced";
      appendToWorkspace(`\n\n## Codex note\n\n${sourceLine}\n\n${value}\n`);
      return "I added a source-aware note to the center Markdown file.";
    }
    if (command === "/commit-workspace" || command === "/commit-notes") {
      await saveWorkspace();
      return `Committed the center Markdown workspace to ${WORKSPACE_PATH}.`;
    }
    if (command === "/search-project") {
      if (!value) return "Give me a project search query.";
      const results = await searchProject(value);
      if (!results.length) return `No project files matched "${value}".`;
      return [
        `Project search for "${value}":`,
        ...results
          .slice(0, 8)
          .map(
            (result) => `- ${result.path} (${result.score}): ${result.snippet}`,
          ),
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
        workspace,
        selectedSources,
        instructions: codexInstructions,
        history: messagesRef.current.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
      } satisfies CodexCliRequest),
    });
    if (!response.ok || !response.body) {
      const result = (await response
        .json()
        .catch(() => null)) as CodexCliResponse | null;
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
    let workspaceAppend = "";
    let workspaceReplace = "";

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
          workspaceAppend = data.workspaceAppend ?? data.notesAppend ?? "";
          workspaceReplace = data.workspaceReplace ?? "";
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

    if (workspaceReplace) replaceWorkspace(workspaceReplace);
    else if (workspaceAppend) appendToWorkspace(`\n\n${workspaceAppend}\n`);
    return (
      finalOutput || streamed.trim() || "Codex CLI returned no visible output."
    );
  }

  function updateStreamingMessage(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content } : message,
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

  function appendToWorkspace(markdown: string) {
    setWorkspace((current) => `${current.trimEnd()}${markdown}`);
    setWorkspaceStatus(`${WORKSPACE_PATH} edited by Codex.`);
  }

  function replaceWorkspace(markdown: string) {
    setWorkspace(`${markdown.trimEnd()}\n`);
    setWorkspaceStatus(`${WORKSPACE_PATH} updated by Codex.`);
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
    <div
      className="codex-workspace"
      style={
        {
          "--codex-scope-width": `${scopePaneWidth}px`,
          "--codex-chat-width": `${chatPaneWidth}px`,
        } as CSSProperties
      }
    >
      <aside className="codex-source-panel" aria-label="Codex sources">
        <section className="codex-source-panel-top">
          <header>
            <p className="eyebrow">Codex</p>
            <h2>Magic Calls</h2>
            <p>Structured operations with fixed scholarly prompts.</p>
          </header>
          <div className="codex-magic-list">
            {MAGIC_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  className={activeMagicAction === action.id ? "active" : ""}
                  onClick={() => setActiveMagicAction(action.id)}
                >
                  <Icon size={15} />
                  <span>
                    <strong>{action.title}</strong>
                    <em>{action.description}</em>
                  </span>
                </button>
              );
            })}
          </div>
          {activeMagicAction ? (
            <div className="codex-magic-box">
              <header>
                <Sparkles size={15} />
                <strong>
                  {MAGIC_ACTIONS.find(
                    (action) => action.id === activeMagicAction,
                  )?.title ?? "Codex magic"}
                </strong>
              </header>
              {activeMagicAction === "search-sources" ? (
                <label>
                  Query
                  <input
                    value={magicQuery}
                    onChange={(event) => setMagicQuery(event.target.value)}
                    placeholder="programmable flute"
                  />
                </label>
              ) : null}
              <div className="codex-magic-select-row">
                <span>
                  {activeMagicAction === "search-sources"
                    ? `${magicSources.length}/${sources.length} sources`
                    : `${magicSections.length}/${sectionPaths.length} sections`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    activeMagicAction === "search-sources"
                      ? setMagicSources(sources)
                      : setMagicSections(sectionPaths)
                  }
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    activeMagicAction === "search-sources"
                      ? setMagicSources([])
                      : setMagicSections([])
                  }
                >
                  None
                </button>
              </div>
              <div className="codex-magic-options">
                {(activeMagicAction === "search-sources"
                  ? sortedSources
                  : sectionPaths
                ).map((path) => {
                  const checked =
                    activeMagicAction === "search-sources"
                      ? magicSources.includes(path)
                      : magicSections.includes(path);
                  return (
                    <label key={path}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          activeMagicAction === "search-sources"
                            ? toggleMagicSource(path)
                            : toggleMagicSection(path)
                        }
                      />
                      <span>
                        {activeMagicAction === "search-sources"
                          ? sourceLabel(path)
                          : (sectionTitlesByPath.get(path) ?? path)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="codex-magic-actions">
                <button
                  type="button"
                  onClick={() => setActiveMagicAction(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void runMagicAction()}
                  disabled={
                    activeMagicAction === "search-sources"
                      ? !magicSources.length
                      : !magicSections.length
                  }
                >
                  Run
                </button>
              </div>
            </div>
          ) : null}
          <div className="codex-active-scope">
            <p className="eyebrow">Active Scope</p>
            <p>
              {selectedSources.length || "No"} sources selected for ad hoc
              commands.
            </p>
          </div>
          <div className="codex-source-list compact">
            {selectedSources.map((source) => (
              <button
                key={source}
                type="button"
                className="selected"
                aria-pressed="true"
                onClick={() => selectSource(source)}
              >
                <FileText size={14} />
                <span>{sourceLabel(source)}</span>
                <em>active</em>
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
      <button
        type="button"
        className="pane-resizer left"
        aria-label="Resize Codex source pane"
        title="Resize Codex source pane"
        onPointerDown={(event) => startCodexPaneResize("left", event)}
      />

      <section className="codex-workspace-panel">
        <header>
          <div>
            <p className="eyebrow">Markdown Workspace</p>
            <h1>{WORKSPACE_PATH}</h1>
            <p>{workspaceStatus}</p>
          </div>
          <div>
            {selectedSources.length === 1 ? (
              <button
                type="button"
                onClick={() => onOpenSource(selectedSources[0])}
              >
                <BookOpen size={15} /> Open Source
              </button>
            ) : null}
            <button type="button" onClick={() => void saveWorkspace()}>
              <Save size={15} /> Save
            </button>
          </div>
        </header>
        <textarea
          aria-label="Codex Markdown workspace"
          value={workspace}
          onChange={(event) => {
            setWorkspace(event.target.value);
            setWorkspaceStatus(`${WORKSPACE_PATH} edited.`);
          }}
          spellCheck
        />
      </section>
      <button
        type="button"
        className="pane-resizer right"
        aria-label="Resize Codex panel"
        title="Resize Codex panel"
        onPointerDown={(event) => startCodexPaneResize("right", event)}
      />

      <aside className="codex-chat-panel" aria-label="Codex messages">
        <header>
          <div className="codex-chat-title-row">
            <button
              type="button"
              aria-label={
                historyView === "history"
                  ? "Back to Codex chat"
                  : "Open Codex history"
              }
              title={historyView === "history" ? "Back to chat" : "History"}
              onClick={() =>
                historyView === "history"
                  ? setHistoryView("chat")
                  : void openHistoryList()
              }
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <p className="eyebrow">Codex</p>
              <h2>{historyView === "history" ? "History" : "Panel"}</h2>
            </div>
          </div>
          {historyView === "history" ? (
            <p>Saved conversations from {HISTORY_ROOT}.</p>
          ) : null}
        </header>
        {historyView === "history" ? (
          <div className="codex-history-list">
            {historyItems.length ? (
              historyItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className={item.path === historyPath ? "active" : ""}
                  onClick={() => void openHistoryChat(item.path)}
                >
                  <span>{formatHistoryDate(item.updatedAt)}</span>
                  <strong>{historyTitle(item)}</strong>
                  <em>{item.messageCount} messages</em>
                  <small>{item.preview}</small>
                </button>
              ))
            ) : (
              <p>No Codex history yet.</p>
            )}
          </div>
        ) : (
          <>
            <div className="codex-message-list">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`codex-message ${message.role} ${message.status ?? ""}`}
                >
                  <span>
                    {message.role === "user" ? (
                      <User size={14} />
                    ) : (
                      <Bot size={14} />
                    )}
                  </span>
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
          </>
        )}
      </aside>
    </div>
  );
}

function summarizeRelated(query: string, result: CodexResponse) {
  const cards = result.related.cards;
  const relationships = result.related.relationships;
  if (!cards.length && !relationships.length) {
    return `No committed Codex relationships for ${query || "that query"} yet. Keep taking Markdown workspace, then promote durable links when ready.`;
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
    ...result.directReferences
      .slice(0, 6)
      .map((reference, index) =>
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

function magicSectionLabel(paths: string[], titlesByPath: Map<string, string>) {
  if (!paths.length) return "all sections";
  if (paths.length === 1) return titlesByPath.get(paths[0]) ?? paths[0];
  return `${paths.length} sections`;
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
  if (status === "started")
    return "Codex started. Waiting for the first token.";
  return `Codex ${status}.`;
}

function encodeURIComponentPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredNumber(
  key: string,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
) {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (stored === null) return fallback;
  const value = Number(stored);
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function startHorizontalDrag(
  event: ReactPointerEvent<HTMLElement>,
  onMove: (clientX: number) => void,
) {
  event.preventDefault();
  const pointerId = event.pointerId;
  event.currentTarget.setPointerCapture?.(pointerId);
  document.body.classList.add("pane-resizing");
  const move = (moveEvent: PointerEvent) => {
    onMove(moveEvent.clientX);
  };
  const stop = () => {
    document.body.classList.remove("pane-resizing");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
}

function createHistoryPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${HISTORY_ROOT}/${stamp}.json`;
}

function historyPathTimestamp(path: string) {
  const stamp = path
    .split("/")
    .at(-1)
    ?.replace(/\.json$/, "");
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

function summarizeHistory(
  path: string,
  history: CodexHistoryFile,
): CodexHistorySummary {
  const firstUserMessage = history.messages.find(
    (message) => message.role === "user",
  );
  const firstCodexMessage = history.messages.find(
    (message) => message.role === "codex",
  );
  return {
    path,
    createdAt: history.createdAt,
    updatedAt: history.updatedAt,
    messageCount: history.messages.length,
    preview:
      firstUserMessage?.content.slice(0, 140) ??
      firstCodexMessage?.content.slice(0, 140) ??
      path,
  };
}

function upsertHistorySummary(
  items: CodexHistorySummary[],
  path: string,
  history: CodexHistoryFile,
) {
  const next = summarizeHistory(path, history);
  return [next, ...items.filter((item) => item.path !== path)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

function historyTitle(item: CodexHistorySummary) {
  return (
    item.path
      .split("/")
      .at(-1)
      ?.replace(/\.json$/, "") ?? item.path
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
