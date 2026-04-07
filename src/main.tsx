import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CLARITY_PROJECT_ID = "w7lukcm2zs";

function initializeMicrosoftClarity(projectId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (document.getElementById("ms-clarity-script")) {
    return;
  }

  const clarityWindow = window as Window & {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
  };

  if (!clarityWindow.clarity) {
    const clarity = (...args: unknown[]) => {
      clarity.q = clarity.q || [];
      clarity.q.push(args);
    };

    clarityWindow.clarity = clarity;
  }

  const script = document.createElement("script");
  script.id = "ms-clarity-script";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;
  document.head.appendChild(script);
}

initializeMicrosoftClarity(CLARITY_PROJECT_ID);

createRoot(document.getElementById("root")!).render(<App />);
