import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeActionConfirm } from "./KnowledgeActionConfirm";

function DialogHarness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(true);

  return (
    <KnowledgeActionConfirm
      open={open}
      onOpenChange={setOpen}
      title="Delete test record?"
      description="This is a test-only action."
      confirmLabel="Delete Record"
      busyLabel="Deleting..."
      busy={false}
      onConfirm={async () => {
        await onConfirm();
        setOpen(false);
      }}
    />
  );
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("KnowledgeActionConfirm", () => {
  it("runs the supplied action once, shows loading, blocks a duplicate click, and closes after success", async () => {
    const pending = deferred<void>();
    const onConfirm = vi.fn(() => pending.promise);
    render(<DialogHarness onConfirm={onConfirm} />);

    const action = screen.getByRole("button", { name: "Delete Record" });
    fireEvent.click(action);
    fireEvent.click(action);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and reports failure when the action rejects", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("network failed");
    });
    render(<DialogHarness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The action could not be completed.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
