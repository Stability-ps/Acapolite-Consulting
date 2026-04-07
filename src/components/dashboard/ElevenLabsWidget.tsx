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
    <section className="fixed bottom-6 right-6 z-[60]">
      <div className="pointer-events-auto">
        <elevenlabs-convai agent-id={ELEVENLABS_AGENT_ID} />
      </div>
    </section>,
    document.body,
  );
}
