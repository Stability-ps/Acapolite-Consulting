import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const statusOptions = ["new", "in_progress", "under_review", "completed", "closed"];

export default function AdminCases() {
  const { isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["admin-cases"],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("*, profiles!cases_user_id_fkey(full_name, email)").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const updateStatus = async (caseId: string, status: string) => {
    const { error } = await supabase.from("cases").update({ status }).eq("id", caseId);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-cases"] });
    }
  };

  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const statusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-yellow-100 text-yellow-700";
      case "under_review": return "bg-purple-100 text-purple-700";
      case "completed": return "bg-green-100 text-green-700";
      case "closed": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">All Cases</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Manage and update client cases</p>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : (
        <div className="space-y-4">
          {cases?.map((c: any) => (
            <div key={c.id} className="bg-card rounded-xl border border-border shadow-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{c.title}</h3>
                  <p className="text-sm text-muted-foreground font-body">{c.case_number} · Client: {c.profiles?.full_name || c.profiles?.email || "Unknown"}</p>
                </div>
                <Badge variant="outline" className={statusColor(c.status)}>
                  {c.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {c.description && <p className="text-sm text-muted-foreground font-body mb-4">{c.description}</p>}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-body">Update status:</span>
                <Select value={c.status} onValueChange={(val) => updateStatus(c.id, val)}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
