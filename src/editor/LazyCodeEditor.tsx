import { lazy, Suspense } from "react";

// Monaco is heavy: it is loaded only when an editor is first shown.
const CodeEditor = lazy(() => import("./CodeEditor"));

interface LazyCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  label: string;
  /** The exercise is solved in this language: the frame turns green. */
  solved: boolean;
}

export function LazyCodeEditor(props: LazyCodeEditorProps) {
  return (
    <Suspense fallback={<p>Chargement de l&apos;éditeur…</p>}>
      <CodeEditor {...props} />
    </Suspense>
  );
}
