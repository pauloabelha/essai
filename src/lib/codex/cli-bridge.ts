import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

interface JsonRpcMessage {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface ThreadState {
  threadId: string;
  projectRoot: string;
  queue: Promise<unknown>;
}

export interface CodexBridgeTurnInput {
  projectRoot: string;
  message: string;
  workspace: string;
  workspacePath?: string;
  workspaceTabs?: Array<{ path: string; title: string }>;
  selectedSources: string[];
  instructions: string;
  history: Array<{ role: string; content: string }>;
  studyContext?: string;
}

export interface CodexBridgeTurnOutput {
  output: string;
  workspaceAppend: string;
  workspaceReplace: string;
  workspacePath: string;
  workspaceCreates: Array<{ title: string; content: string }>;
}

export interface CodexBridgeTurnEvents {
  onQueued?: () => void;
  onStarted?: () => void;
  onDelta?: (delta: string) => void;
}

const REQUEST_TIMEOUT_MS = 30_000;
const STALE_TURN_MS = 45_000;
const TURN_TIMEOUT_MS = 90_000;

class CodexAppServerBridge {
  private process: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private nextId = 1;
  private ready: Promise<void> | null = null;
  private pending = new Map<number | string, PendingRequest>();
  private threads = new Map<string, ThreadState>();
  private activeTurns = new Map<
    string,
    {
      output: string;
      resolve: (value: string) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
      startedAt: number;
      onDelta?: (delta: string) => void;
    }
  >();

  async runTurn(
    input: CodexBridgeTurnInput,
    events: CodexBridgeTurnEvents = {},
  ): Promise<CodexBridgeTurnOutput> {
    return this.runTurnWithRecovery(input, events, true);
  }

  cancelProject(projectRoot: string) {
    const thread = this.threads.get(projectRoot);
    if (!thread || !this.activeTurns.has(thread.threadId)) return;
    this.reset(new Error("Codex turn cancelled by the client."));
  }

  private async runTurnWithRecovery(
    input: CodexBridgeTurnInput,
    events: CodexBridgeTurnEvents,
    allowStaleRestart: boolean,
  ): Promise<CodexBridgeTurnOutput> {
    await this.ensureReady();
    const thread = await this.ensureThread(input.projectRoot);
    const activeTurn = this.activeTurns.get(thread.threadId);
    if (
      allowStaleRestart &&
      activeTurn &&
      Date.now() - activeTurn.startedAt > STALE_TURN_MS
    ) {
      this.reset(new Error("Restarting stale Codex turn."));
      return this.runTurnWithRecovery(input, events, false);
    }

    const prompt = buildPrompt(input);
    const run = async () => {
      events.onStarted?.();
      const output = await this.startTurn(thread.threadId, prompt, events);
      return {
        output: stripWorkspaceBlocks(output).trim(),
        workspaceAppend: extractWorkspaceAppend(output),
        workspaceReplace: extractWorkspaceReplace(output),
        workspacePath: extractWorkspacePath(output),
        workspaceCreates: extractWorkspaceCreates(output),
      };
    };

    events.onQueued?.();
    const queued = thread.queue.then(run, run);
    thread.queue = queued.catch(() => undefined);
    return queued;
  }

  private async ensureReady() {
    if (!this.ready) {
      this.ready = this.start();
    }
    return this.ready;
  }

  private async start() {
    this.process = spawn("codex", ["app-server", "--listen", "stdio://"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
    });

    this.process.stdout.on("data", (chunk) => this.onStdout(chunk.toString()));
    this.process.stderr.on("data", () => {
      // Codex emits plugin and sandbox warnings on stderr during warmup.
    });
    this.process.on("exit", () =>
      this.reset(new Error("Codex app-server exited.")),
    );
    this.process.on("error", (error) => this.reset(error));

    await this.request("initialize", {
      clientInfo: { name: "essai", title: "Essai", version: "0.1.0" },
      capabilities: {
        experimentalApi: true,
        optOutNotificationMethods: [],
      },
    });
  }

  private reset(error: Error) {
    const process = this.process;
    this.process = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    for (const turn of this.activeTurns.values()) {
      clearTimeout(turn.timer);
      turn.reject(error);
    }
    this.pending.clear();
    this.activeTurns.clear();
    this.threads.clear();
    this.ready = null;
    if (process && !process.killed) {
      process.kill();
    }
  }

  private async ensureThread(projectRoot: string) {
    const existing = this.threads.get(projectRoot);
    if (existing) return existing;

    const result = (await this.request("thread/start", {
      cwd: projectRoot,
      approvalPolicy: "never",
      sandbox: "read-only",
      baseInstructions: [
        "You are the Codex CLI behind Essai's Codex panel.",
        "You may read the current Essai book folder to answer scholarly questions.",
        "Never edit manuscript section files, main.md, chapter files, or source ledgers.",
        "Do not run file-writing commands.",
        "When useful, you may update the center Codex workspace by returning Markdown in <codex-workspace-append> or <codex-workspace-replace> tags.",
        "Only use workspace tags for the shared Codex Markdown workspace, never for manuscript prose.",
      ].join("\n"),
      developerInstructions:
        "Keep answers concise, source-grounded, and cite file paths you inspected.",
      ephemeral: true,
      threadSource: "user",
    })) as { thread?: { id?: string } };

    const threadId = result.thread?.id;
    if (!threadId)
      throw new Error("Codex app-server did not return a thread id.");
    const thread: ThreadState = {
      threadId,
      projectRoot,
      queue: Promise.resolve(),
    };
    this.threads.set(projectRoot, thread);
    return thread;
  }

  private startTurn(
    threadId: string,
    prompt: string,
    events: CodexBridgeTurnEvents,
  ) {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error("Codex app-server turn timed out.");
        this.activeTurns.delete(threadId);
        reject(error);
        this.reset(error);
      }, TURN_TIMEOUT_MS);

      this.activeTurns.set(threadId, {
        output: "",
        resolve,
        reject,
        timer,
        startedAt: Date.now(),
        onDelta: events.onDelta,
      });

      void this.request(
        "turn/start",
        {
          threadId,
          input: [{ type: "text", text: prompt, text_elements: [] }],
          approvalPolicy: "never",
          sandboxPolicy: { type: "readOnly", networkAccess: false },
        },
        REQUEST_TIMEOUT_MS,
      ).catch((error) => {
        const turn = this.activeTurns.get(threadId);
        if (turn) {
          clearTimeout(turn.timer);
          this.activeTurns.delete(threadId);
          reject(error);
        }
      });
    });
  }

  private request(
    method: string,
    params: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ) {
    if (!this.process?.stdin.writable) {
      return Promise.reject(new Error("Codex app-server is not running."));
    }
    const id = this.nextId++;
    const message = { id, method, params };
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.process?.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  private respond(id: number | string, result: unknown) {
    this.process?.stdin.write(`${JSON.stringify({ id, result })}\n`);
  }

  private onStdout(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        this.handleMessage(JSON.parse(line) as JsonRpcMessage);
      } catch {
        // Ignore non-protocol output.
      }
    }
  }

  private handleMessage(message: JsonRpcMessage) {
    if (message.id !== undefined && (message.result || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new Error(message.error.message ?? "Codex request failed."),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method) {
      this.respond(message.id, { decision: "denied" });
      return;
    }

    if (!message.method || !message.params) return;
    if (message.method === "item/agentMessage/delta") {
      const params = message.params as { threadId?: string; delta?: string };
      const turn = params.threadId
        ? this.activeTurns.get(params.threadId)
        : null;
      if (turn) {
        const delta = params.delta ?? "";
        turn.output += delta;
        if (delta) turn.onDelta?.(delta);
      }
      return;
    }
    if (message.method === "item/completed") {
      const params = message.params as { threadId?: string; item?: unknown };
      const turn = params.threadId
        ? this.activeTurns.get(params.threadId)
        : null;
      const text = extractText(params.item);
      if (turn && text && !turn.output.includes(text)) {
        turn.output += text;
      }
      return;
    }
    if (message.method === "turn/completed") {
      const params = message.params as {
        threadId?: string;
        turn?: { status?: string; error?: { message?: string } };
      };
      const turn = params.threadId
        ? this.activeTurns.get(params.threadId)
        : null;
      if (!params.threadId || !turn) return;
      clearTimeout(turn.timer);
      this.activeTurns.delete(params.threadId);
      if (params.turn?.status === "failed") {
        turn.reject(
          new Error(params.turn.error?.message ?? "Codex turn failed."),
        );
      } else {
        turn.resolve(turn.output.trim());
      }
    }
  }
}

export const codexBridge = new CodexAppServerBridge();

function buildPrompt({
  message,
  workspace,
  workspacePath,
  workspaceTabs,
  selectedSources,
  instructions,
  history,
  studyContext,
}: CodexBridgeTurnInput) {
  const compactHistory = history
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.content.slice(0, 1200)}`)
    .join("\n\n");

  return `You are responding inside Essai's Codex panel.

Hard boundaries:
- You may read manuscript sections, sources, concepts, objects, notes, and Codex files.
- You must not edit manuscript section files or source ledgers.
- The center panel is a collaborative Markdown scratchpad with multiple editable tabs. The active tab is ${workspacePath || "codex/workspace.md"}.
- Existing scratchpad tabs:
${workspaceTabs?.length ? workspaceTabs.map((tab) => `  - ${tab.title}: ${tab.path}`).join("\n") : "  - Workspace: codex/workspace.md"}
- If your answer should update that workspace, return one of these blocks:
<codex-workspace-append>
...markdown to append...
</codex-workspace-append>
<codex-workspace-replace>
...complete revised workspace markdown...
</codex-workspace-replace>
- Prefer replace when reorganizing the workspace from the current contents; preserve the author's existing useful text.
- The web app will apply append/replace blocks to the active tab unless you include <codex-workspace-path>path</codex-workspace-path>.
- If a new tab is warranted, return <codex-workspace-create title="Short title">...markdown...</codex-workspace-create>; the app will create it and make it current.
- Mention file paths you used.

Persistent Codex instructions from the user:
${instructions.trim() || "(none)"}

Selected source scope:
${selectedSources.length ? selectedSources.map((source) => `- ${source}`).join("\n") : "(none selected)"}

Study retrieval context from Essai's indexed sources:
${studyContext?.trim() || "(no indexed Study passages were attached)"}

Current active Codex scratchpad (${workspacePath || "codex/workspace.md"}):
${workspace.slice(0, 12000) || "(empty)"}

Recent panel messages:
${compactHistory || "(none)"}

User message:
${message}
`;
}

function extractText(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const record = item as {
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (record.type !== "message" || !Array.isArray(record.content)) return "";
  return record.content
    .map((content) =>
      content.type === "output_text" ? (content.text ?? "") : "",
    )
    .join("");
}

function extractWorkspaceAppend(output: string) {
  const match = output.match(
    /<codex-workspace-append>\s*([\s\S]*?)\s*<\/codex-workspace-append>/,
  );
  if (match?.[1]) return match[1].trim();
  const legacyMatch = output.match(
    /<codex-notes-append>\s*([\s\S]*?)\s*<\/codex-notes-append>/,
  );
  return legacyMatch?.[1]?.trim() ?? "";
}

function extractWorkspaceReplace(output: string) {
  const match = output.match(
    /<codex-workspace-replace>\s*([\s\S]*?)\s*<\/codex-workspace-replace>/,
  );
  return match?.[1]?.trim() ?? "";
}

function extractWorkspacePath(output: string) {
  const match = output.match(
    /<codex-workspace-path>\s*([\s\S]*?)\s*<\/codex-workspace-path>/,
  );
  return match?.[1]?.trim() ?? "";
}

function extractWorkspaceCreates(output: string) {
  return [
    ...output.matchAll(
      /<codex-workspace-create(?:\s+title="([^"]+)")?\s*>\s*([\s\S]*?)\s*<\/codex-workspace-create>/g,
    ),
  ].map((match) => ({
    title: match[1]?.trim() || "Codex note",
    content: match[2]?.trim() || "",
  }));
}

function stripWorkspaceBlocks(output: string) {
  return output
    .replace(/<codex-workspace-append>[\s\S]*?<\/codex-workspace-append>/g, "")
    .replace(
      /<codex-workspace-replace>[\s\S]*?<\/codex-workspace-replace>/g,
      "",
    )
    .replace(/<codex-workspace-path>[\s\S]*?<\/codex-workspace-path>/g, "")
    .replace(
      /<codex-workspace-create(?:\s+title="[^"]+")?\s*>[\s\S]*?<\/codex-workspace-create>/g,
      "",
    )
    .replace(/<codex-notes-append>[\s\S]*?<\/codex-notes-append>/g, "");
}
