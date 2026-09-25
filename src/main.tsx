import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { captureAdAttribution } from "@/lib/googleAds";

const isNativeApp = () =>
  typeof window !== "undefined" &&
  Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

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

if (isNativeApp()) {
  document.documentElement.classList.add("capacitor-native");
  document.documentElement.classList.add(`capacitor-${(window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() || "native"}`);
} else {
  initializeMicrosoftClarity(CLARITY_PROJECT_ID);
  captureAdAttribution();
}

createRoot(document.getElementById("root")!).render(<App />);
