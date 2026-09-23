// Renders a single JSON-LD <script> tag from a plain object. All inputs in
// this codebase come from src/lib/structuredData.ts's static builders, not
// user input, but the '<' escape below is kept anyway as standard practice
// for anything serialized into a <script> tag — it prevents a stray
// "</script" substring in a string value from prematurely closing the tag.
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
