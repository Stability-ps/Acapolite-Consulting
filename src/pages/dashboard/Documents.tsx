import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Image, File } from "lucide-react";
import { toast } from "sonner";

export default function Documents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }
    const { error: dbError } = await supabase.from("documents").insert({
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type,
      file_size: file.size,
    });
    if (dbError) toast.error(dbError.message);
    else {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
    setUploading(false);
  };

  const getIcon = (type?: string | null) => {
    if (type?.startsWith("image")) return Image;
    if (type?.includes("pdf")) return FileText;
    return File;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Documents</h1>
          <p className="text-muted-foreground font-body text-sm">Upload and manage your tax documents</p>
        </div>
        <label>
          <Button disabled={uploading} className="rounded-xl cursor-pointer" asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Document"}
            </span>
          </Button>
          <Input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
        </label>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : documents && documents.length > 0 ? (
        <div className="grid gap-3">
          {documents.map((doc) => {
            const Icon = getIcon(doc.file_type);
            return (
              <div key={doc.id} className="bg-card rounded-xl border border-border shadow-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body font-medium text-foreground truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground font-body">
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ""} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full font-body ${
                  doc.status === "uploaded" ? "bg-blue-100 text-blue-700" :
                  doc.status === "reviewed" ? "bg-green-100 text-green-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {doc.status}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-body">No documents uploaded yet. Upload IRP5s, SARS letters, bank statements and more.</p>
        </div>
      )}
    </div>
  );
}
