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
            padding: "52px 0",
            color: "var(--ink)",
            caretColor: "var(--ink)",
            width: "min(920px, calc(100% - 96px))",
            margin: "0 auto",
          },
          ".cm-line": {
            padding: "0",
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
