import ReactMarkdown, { type Components } from "react-markdown";

// The exercise title is the page's h2, so the statement's own headings start one level lower.
// Links are rendered as plain text: following one would navigate the app window away.
const components: Components = {
  h1: ({ children }) => <h2>{children}</h2>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  a: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <pre className="snippet">{children}</pre>,
};

/** Renders trusted exercise Markdown. Raw HTML is not supported, on purpose. */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}
