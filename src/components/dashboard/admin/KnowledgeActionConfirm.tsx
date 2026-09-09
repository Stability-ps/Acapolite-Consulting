import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface KnowledgeActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
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
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && busy) return; onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className={destructive ? "bg-red-600 text-white hover:bg-red-700" : undefined}
          >
            {busy ? (busyLabel ?? "Working...") : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
