import Editor from "@monaco-editor/react";
import { useTheme } from "../theme/theme";
import "./setup";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  label: string;
  solved: boolean;
}

export default function CodeEditor({ value, onChange, language, label, solved }: CodeEditorProps) {
  const dark = useTheme() === "dark";

  return (
    <div className="code-editor" data-solved={solved}>
      <Editor
        height="100%"
        language={language}
        theme={dark ? "synack-dark" : "synack-light"}
        value={value}
        onChange={(next) => {
          onChange(next ?? "");
        }}
        options={{
          ariaLabel: label,
          fontFamily: '"Space Mono", monospace',
          fontSize: 14,
          minimap: { enabled: false },
          tabSize: 4,
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
