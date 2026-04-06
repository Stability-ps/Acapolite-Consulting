import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function Cases() {
  const { user } = useAuth();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["cases", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("cases").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700 border-blue-200";
      case "in_progress": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "under_review": return "bg-purple-100 text-purple-700 border-purple-200";
      case "completed": return "bg-green-100 text-green-700 border-green-200";
      case "closed": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">My Cases</h1>
      <p className="text-muted-foreground font-body text-sm mb-8">Track all your tax cases</p>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading cases...</div>
      ) : cases && cases.length > 0 ? (
        <div className="space-y-4">
          {cases.map((c) => (
            <div key={c.id} className="bg-card rounded-xl border border-border shadow-card p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{c.title}</h3>
                  <p className="text-sm text-muted-foreground font-body">{c.case_number}</p>
                </div>
                <Badge variant="outline" className={statusColor(c.status)}>
                  {c.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {c.description && <p className="text-sm text-muted-foreground font-body mb-3">{c.description}</p>}
              <div className="flex gap-4 text-xs text-muted-foreground font-body">
                <span>Type: {c.type.replace(/_/g, " ")}</span>
                <span>Priority: {c.priority}</span>
                <span>Created: {new Date(c.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground font-body">No cases yet. Your consultant will create cases for you.</p>
        </div>
      )}
    </div>
  );
}
