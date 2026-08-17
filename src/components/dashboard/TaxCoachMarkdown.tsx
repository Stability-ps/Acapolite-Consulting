import { Fragment, ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => (
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>
  ));
}

export function TaxCoachMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2">
      {content.split("\n").map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="h-1" aria-hidden="true" />;

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const className = heading[1].length === 1
            ? "pt-1 text-lg font-semibold"
            : "pt-1 text-base font-semibold";
          return <h3 key={index} className={className}>{renderInline(heading[2])}</h3>;
        }

        const unordered = line.match(/^[-*]\s+(.+)$/);
        if (unordered) {
          return (
            <div key={index} className="flex gap-2 pl-1">
              <span aria-hidden="true">•</span>
              <span>{renderInline(unordered[1])}</span>
            </div>
          );
        }

        const ordered = line.match(/^(\d+)\.\s+(.+)$/);
        if (ordered) {
          return (
            <div key={index} className="flex gap-2 pl-1">
              <span className="min-w-5" aria-hidden="true">{ordered[1]}.</span>
              <span>{renderInline(ordered[2])}</span>
            </div>
          );
        }

        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
