import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

// Simulates a crashing page (e.g. AdminSocialMedia hitting a null relation
// or a bad date during render).
function Bomb(): never {
  throw new Error("Simulated Social Media page crash");
}

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>);
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  // REGRESSION: before this boundary existed, main.tsx had zero error
  // handling anywhere - an uncaught render error in any single page
  // unmounted the entire React root (React 18 behavior with no boundary),
  // producing a completely blank white page for the whole app.
  it("REGRESSION: a page that throws during render shows a fallback instead of unmounting to a blank page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong loading this page.")).toBeInTheDocument();
    expect(screen.getByText("Simulated Social Media page crash")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  // REGRESSION: proves the containment property specifically - content
  // rendered OUTSIDE the boundary (the sidebar/header shell in Dashboard.tsx)
  // survives a crash INSIDE it, so a broken Social Media page can't take
  // down navigation or the rest of the app with it.
  it("REGRESSION: a crash inside the boundary does not remove sibling content rendered outside it", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <nav data-testid="sidebar">Sidebar still here</nav>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      </div>,
    );
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong loading this page.")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
