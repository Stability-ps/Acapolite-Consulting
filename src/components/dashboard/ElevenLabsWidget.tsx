import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ELEVENLABS_SCRIPT_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";
const ELEVENLABS_AGENT_ID = "agent_8701kmsf4kqgfmf9qmg798nrp6d3";

export function ElevenLabsWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${ELEVENLABS_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = ELEVENLABS_SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <section className="fixed bottom-4 right-6 z-[60]">
      <div className="relative pointer-events-auto">
        <elevenlabs-convai agent-id={ELEVENLABS_AGENT_ID} />
        <div className="pointer-events-none absolute left-1/2 top-full mt-3 h-16 w-px -translate-x-1/2 bg-gradient-to-b from-sky-300/40 via-sky-300/15 to-transparent shadow-[0_12px_24px_rgba(56,189,248,0.35)]" />
      </div>
    </section>,
    document.body,
  );
}
