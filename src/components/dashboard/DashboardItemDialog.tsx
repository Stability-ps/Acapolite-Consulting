import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DashboardItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function DashboardItemDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DashboardItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[28px] border border-border bg-card p-0 overflow-hidden">
        <div className="border-b border-border px-6 py-5 sm:px-7">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="font-display text-2xl text-foreground">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="font-body text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 sm:px-7">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
