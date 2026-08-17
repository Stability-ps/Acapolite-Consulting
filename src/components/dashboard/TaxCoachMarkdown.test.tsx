import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaxCoachMarkdown } from "./TaxCoachMarkdown";

describe("TaxCoachMarkdown", () => {
  it("renders headings and bold text without showing markdown symbols", () => {
    const { container } = render(
      <TaxCoachMarkdown content={"## Business structure\nChoose a **private company**."} />,
    );

    expect(screen.getByRole("heading", { name: "Business structure" })).toBeInTheDocument();
    expect(screen.getByText("private company").tagName).toBe("STRONG");
    expect(container.textContent).not.toContain("##");
    expect(container.textContent).not.toContain("**");
  });

  it("renders bullet and numbered list markers cleanly", () => {
    const { container } = render(
      <TaxCoachMarkdown content={"- VAT registration\n1. Gather records"} />,
    );

    expect(container).toHaveTextContent("•VAT registration");
    expect(container).toHaveTextContent("1.Gather records");
  });
});
