import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/language/typescript/ts.worker?worker";

// Monaco is bundled with the app (no CDN): it must work offline and under the strict CSP.
// Only the workers of the languages SynAck edits are registered: the base one, plus the
// TypeScript one, which also powers JavaScript. Other languages use the base worker.
self.MonacoEnvironment = {
  getWorker: (_workerId, label) =>
    label === "typescript" || label === "javascript" ? new TypeScriptWorker() : new EditorWorker(),
};

// Editor themes on the SynAck palette. The values are copied from src/theme/tokens.css (Monaco
// cannot read CSS variables): change them together.
monaco.editor.defineTheme("synack-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#121011",
    "editorLineNumber.foreground": "#7f757b",
    "editorLineNumber.activeForeground": "#a71161",
    "editor.selectionBackground": "#fec2e1",
    "editor.lineHighlightBackground": "#faf8f9",
    "editorCursor.foreground": "#d11a7b",
  },
});
monaco.editor.defineTheme("synack-dark", {
  base: "vs-dark",
  inherit: true,
  // Softer than the stock dark syntax colors: a dusk palette that rests the eyes.
  rules: [
    { token: "comment", foreground: "8d8396", fontStyle: "italic" },
    { token: "keyword", foreground: "e48bb9" },
    { token: "string", foreground: "a8d5a2" },
    { token: "number", foreground: "e6b87a" },
    { token: "type", foreground: "8fc5e8" },
    { token: "operator", foreground: "c9bfd3" },
    { token: "delimiter", foreground: "c9bfd3" },
    { token: "identifier", foreground: "e7e1ec" },
  ],
  colors: {
    "editor.background": "#262230",
    "editor.foreground": "#e7e1ec",
    "editorLineNumber.foreground": "#8a8195",
    "editorLineNumber.activeForeground": "#e48bb9",
    "editor.selectionBackground": "#5e3f58",
    "editor.lineHighlightBackground": "#2f2a3a",
    "editorCursor.foreground": "#e48bb9",
    "editorIndentGuide.background1": "#3b3646",
    "editorWidget.background": "#353040",
    "scrollbarSlider.background": "#5b546780",
  },
});

// The editor measures characters once: re-measure when Space Mono has finished loading.
void document.fonts.load('14px "Space Mono"').then(() => {
  monaco.editor.remeasureFonts();
});

loader.config({ monaco });
