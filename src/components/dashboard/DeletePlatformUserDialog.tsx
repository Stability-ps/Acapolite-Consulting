import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Button } from "@/components/ui/button";

type DeletePreviewResponse = {
  target: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
  };
  preview: Record<string, number>;
  warnings: string[];
};

interface DeletePlatformUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetProfileId: string | null;
  titleName: string;
  entityLabel: "client" | "practitioner";
  onDeleted?: () => void;
}

function formatLabel(key: string) {
  return key.replace(/_/g, " ");
}

export function DeletePlatformUserDialog({
  open,
  onOpenChange,
  targetProfileId,
  titleName,
  entityLabel,
  onDeleted,
}: DeletePlatformUserDialogProps) {
  const [preview, setPreview] = useState<DeletePreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open || !targetProfileId) {
      setPreview(null);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setLoadingPreview(true);
      const { data, error } = await supabase.functions.invoke("delete-platform-user", {
        body: {
          target_profile_id: targetProfileId,
          mode: "preview",
        },
      });

      if (cancelled) {
        return;
      }

      if (error) {
        toast.error(error.message || "Unable to load the delete preview.");
        onOpenChange(false);
        setLoadingPreview(false);
        return;
      }

      if ((data as { error?: string } | null)?.error) {
        toast.error((data as { error: string }).error);
        onOpenChange(false);
        setLoadingPreview(false);
        return;
      }

      setPreview(data as DeletePreviewResponse);
      setLoadingPreview(false);
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [onOpenChange, open, targetProfileId]);

  const sortedPreviewItems = useMemo(
    () =>
      Object.entries(preview?.preview ?? {})
        .filter(([, count]) => Number(count) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1])),
    [preview],
  );

  const handleDelete = async () => {
    if (!targetProfileId) {
      return;
    }

    setIsDeleting(true);

    const { data, error } = await supabase.functions.invoke("delete-platform-user", {
      body: {
        target_profile_id: targetProfileId,
        mode: "delete",
      },
    });

    setIsDeleting(false);

    if (error) {
      toast.error(error.message || `Unable to delete this ${entityLabel}.`);
      return;
    }

    if ((data as { error?: string } | null)?.error) {
      toast.error((data as { error: string }).error);
      return;
    }

    toast.success(`${entityLabel === "client" ? "Client" : "Practitioner"} deleted successfully.`);
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <DashboardItemDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${entityLabel === "client" ? "Client" : "Practitioner"}`}
      description={`Review everything related to ${titleName} before permanently deleting this ${entityLabel} account.`}
    >
      {loadingPreview ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading deletion preview...
        </div>
      ) : preview ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  This action is permanent and cannot be undone.
                </p>
                <p className="mt-1 text-sm text-red-700">
                  Account: {preview.target.full_name || preview.target.email || titleName}
                </p>
              </div>
            </div>
          </div>

          {preview.warnings.length ? (
            <div className="space-y-3">
              {preview.warnings.map((warning) => (
                <div key={warning} className="rounded-xl border border-border bg-accent/20 p-3 text-sm text-foreground">
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Related Records
            </p>
            {sortedPreviewItems.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {sortedPreviewItems.map(([key, count]) => (
                  <div key={key} className="rounded-xl border border-border bg-accent/20 p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatLabel(key)}</p>
                    <p className="mt-2 font-display text-2xl text-foreground">{count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No related records were found.</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-red-600 hover:bg-red-700"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirm Delete
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </DashboardItemDialog>
  );
}
