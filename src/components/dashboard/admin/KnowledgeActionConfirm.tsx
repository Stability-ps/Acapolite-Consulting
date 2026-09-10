import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";

interface KnowledgeActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => Promise<void>;
}

export function KnowledgeActionConfirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel,
  destructive = true,
  busy,
  onConfirm,
}: KnowledgeActionConfirmProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitInFlight = useRef(false);
  const isBusy = busy || isSubmitting;

  const handleConfirm = async () => {
    if (isBusy || submitInFlight.current) return;

    submitInFlight.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError("The action could not be completed. No success was recorded.");
    } finally {
      submitInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && isBusy) return; onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isBusy}
            className={destructive ? "bg-red-600 text-white hover:bg-red-700" : undefined}
          >
            {isBusy ? (busyLabel ?? "Working...") : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
