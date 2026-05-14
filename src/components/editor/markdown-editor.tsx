"use client";

import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";

export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
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
      extensions={[
        markdown(),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            background: "transparent",
            fontSize: "16px",
            height: "100%",
          },
          ".cm-content": {
            fontFamily:
              'var(--font-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
            lineHeight: "1.75",
            padding: "42px min(7vw, 86px)",
            color: "var(--ink)",
            caretColor: "var(--ink)",
          },
          ".cm-scroller": {
            fontFamily: "inherit",
          },
          ".cm-focused": {
            outline: "none",
          },
          ".cm-gutters": {
            background: "transparent",
            border: "none",
          },
          ".cm-activeLine": {
            background: "transparent",
          },
        }),
      ]}
      onChange={onChange}
      theme="light"
    />
  );
}
