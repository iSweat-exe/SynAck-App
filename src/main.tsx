import "@fontsource/space-mono/latin-400.css";
import "@fontsource/space-mono/latin-400-italic.css";
import "@fontsource/space-mono/latin-700.css";
import "@fontsource/space-mono/latin-700-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initTheme } from "./theme/theme";
import "./theme/tokens.css";
import "./index.css";
import "./theme/components.css";
import "./theme/protocols.css";

// Before the first render, so the window never flashes the wrong theme.
initTheme();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
