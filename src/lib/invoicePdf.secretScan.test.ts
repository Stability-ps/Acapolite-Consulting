import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Regression guard for the incident where a live external PDF-provider API
// key was hardcoded as a fallback in this file and shipped in the public
// browser bundle. See generate-invoice-pdf (Supabase Edge Function) for
// where authenticated PDF generation now happens instead.
//
// This intentionally scans the whole src/ tree, not just this file, so a
// future re-introduction anywhere in the frontend still gets caught.

const SRC_ROOT = join(__dirname, "..");
const THIS_FILE = join(__dirname, "invoicePdf.secretScan.test.ts");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && full !== THIS_FILE) {
      // Exclude this scan file itself - it necessarily references the
      // strings/patterns it's checking for, in its own assertions.
      out.push(full);
    }
  }
  return out;
}

describe("no PDF-provider secret in the frontend bundle", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("the previously-leaked provider key literal does not appear anywhere in src/", () => {
    // Reconstructed from two halves so this file itself can never be the
    // thing that reintroduces a searchable copy of the literal key.
    const leakedKey = ["ih_live_9be7d51f616815f04121124", "e0a09a08ce117fc343ebb695a"].join("");
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes(leakedKey));
    expect(offenders).toEqual([]);
  });

  it("VITE_PDF_API_KEY is never referenced (provider key must be server-side only)", () => {
    const offenders = files.filter((file) => readFileSync(file, "utf8").includes("VITE_PDF_API_KEY"));
    expect(offenders).toEqual([]);
  });

  it("no other ih_live_/ih_test_ style provider key is hardcoded anywhere in src/", () => {
    const pattern = /\bih_(live|test)_[a-f0-9]{20,}\b/;
    const offenders = files.filter((file) => pattern.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("invoicePdf.ts no longer builds an Authorization header to the external PDF provider directly", () => {
    const content = readFileSync(join(SRC_ROOT, "lib", "invoicePdf.ts"), "utf8");
    expect(content).not.toMatch(/Authorization:\s*`Bearer \$\{pdfApiKey/);
    expect(content).not.toContain("nxqtduvaaacxsxkkaopd.supabase.co");
  });
});
