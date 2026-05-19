"use client";

import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";
import { useTheme } from "@/components/providers/theme-provider";
import { useMemo } from "react";

export function MarkdownEditor({
  value,
  onChange,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const editorTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            background: "var(--editor-bg)",
            color: "var(--editor-ink)",
            fontSize: "16px",
            height: "100%",
          },
          ".cm-editor": {
            background: "var(--editor-bg)",
          },
          ".cm-content": {
            fontFamily:
              'var(--font-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            lineHeight: "1.75",
            padding: "52px 0",
            color: "var(--editor-ink)",
            caretColor: "var(--editor-caret)",
            width: "min(920px, calc(100% - 96px))",
            margin: "0 auto",
          },
          ".cm-line": {
            padding: "0",
          },
          ".cm-scroller": {
            background: "var(--editor-bg)",
            fontFamily: "inherit",
          },
          ".cm-focused": {
            outline: "none",
          },
          ".cm-cursor": {
            borderLeftColor: "var(--editor-caret)",
          },
          "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
            {
              backgroundColor: "var(--editor-selection)",
            },
          ".cm-gutters": {
            background: "var(--editor-bg)",
            border: "none",
            color: "var(--editor-muted)",
          },
          ".cm-activeLine": {
            background: "var(--editor-line)",
          },
          ".cm-placeholder": {
            color: "var(--editor-muted)",
          },
          ".cm-matchingBracket": {
            background: "var(--editor-selection)",
            color: "var(--editor-ink)",
          },
          ".cm-panels, .cm-tooltip": {
            background: "var(--surface-2)",
            borderColor: "var(--rule)",
            color: "var(--ink)",
          },
        },
        { dark: isDark },
      ),
    [isDark],
  );
  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: (view) => {
            onSave?.(view.state.doc.toString());
            return true;
          },
        },
      ]),
    [onSave],
  );

  return (
    <CodeMirror
      value={value}
      height="100%"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      extensions={[markdown(), EditorView.lineWrapping, editorTheme, saveKeymap]}
      onChange={onChange}
      theme={isDark ? "dark" : "light"}
    />
  );
}
