import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowDown, ArrowUp, Ban, Bot, Calendar, CheckCircle2, Clock3, ExternalLink, ImageIcon,
  Link2, Loader2, Megaphone, Pause, Play, Plus, RefreshCw, RotateCcw, Settings, ShieldCheck, Trash2, Upload, XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Enums, Tables } from "@/integrations/supabase/types";
import {
  SOCIAL_PLATFORM_RULES, type SocialPlatformKey, validateAssetForPlatform,
} from "@/lib/socialPlatformRules";
import {
  chooseInstagramFeedTarget, computeContainLayout, FACEBOOK_FALLBACK_TARGET, needsManualAdjustment,
} from "@/lib/socialImageTransform";
import { formatInBusinessTimezone, parseLocalDateTimeInZone, toLocalDateTimeInputValue, BUSINESS_TIMEZONE } from "@/lib/socialTimezone";
import { getSocialAssetPreviewUrl, uploadSocialMediaAsset } from "@/lib/socialMediaAssets";

type SocialAsset = Tables<"social_media_assets">;
type SocialCampaign = Tables<"social_campaigns">;
type SocialCampaignItem = Tables<"social_campaign_items">;
type SocialScheduledPost = Tables<"social_scheduled_posts">;
type SocialAccount = Tables<"social_accounts">;
type SocialPlatformVariant = Tables<"social_platform_variants">;
type SocialPlatform = Enums<"social_platform">;

const SOCIAL_CAMPAIGN_ACTIVATE_URL = "https://frormnagythfpiuzgfkz.supabase.co/functions/v1/social-campaign-activate";
const SOCIAL_CONNECTION_HEALTH_URL = "https://frormnagythfpiuzgfkz.supabase.co/functions/v1/social-connection-health";
const SOCIAL_GENERATE_VARIANTS_URL = "https://frormnagythfpiuzgfkz.supabase.co/functions/v1/social-generate-variants";

const PLATFORM_LABELS: Record<SocialPlatform, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn" };
const PLATFORM_TO_RULE_KEY: Record<SocialPlatform, SocialPlatformKey> = {
  facebook: "facebook_feed",
  instagram: "instagram_feed",
  linkedin: "linkedin_company_page",
};

function assetForValidation(asset: SocialAsset) {
  return { mimeType: asset.mime_type, width: asset.width_px, height: asset.height_px, fileSizeBytes: asset.file_size_bytes };
}

// Meta's debug_token can list the same scope more than once - once flat
// (app-wide) and again granularly per asset, or as separate granular
// entries from different grant batches - which rendered as visible
// duplicate badges. This merges everything into one entry per scope name,
// combining all the target_ids it's granted for across every entry.
function dedupeScopeDisplay(scopes: string[], granularScopes: { scope: string; target_ids?: string[] }[]) {
  const targetIdsByScope = new Map<string, Set<string>>();
  const ungatedScopes = new Set(scopes);
  for (const g of granularScopes) {
    const existing = targetIdsByScope.get(g.scope) || new Set<string>();
    (g.target_ids || []).forEach((id) => existing.add(id));
    if (!g.target_ids || g.target_ids.length === 0) ungatedScopes.add(g.scope);
    targetIdsByScope.set(g.scope, existing);
  }
  const allScopeNames = new Set([...ungatedScopes, ...targetIdsByScope.keys()]);
  return Array.from(allScopeNames).map((scope) => ({
    scope,
    targetCount: targetIdsByScope.get(scope)?.size || 0,
    ungated: ungatedScopes.has(scope),
  }));
}

async function logSocialActivity(action: string, targetId: string, metadata: Record<string, unknown>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase.from("system_activity_log").insert({
    actor_profile_id: userData.user.id,
    actor_role: "admin",
    action,
    target_type: "social_account",
    target_id: targetId,
    metadata,
  });
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function campaignStatusBadgeClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "approved") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "completed") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status === "archived") return "border-slate-200 bg-slate-100 text-slate-500";
  return "border-border bg-muted/40 text-muted-foreground"; // draft
}

function postStatusBadgeClass(status: string) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "publishing") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "cancelled" || status === "skipped") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-800"; // scheduled/draft
}

function healthBadgeClass(status: string | null) {
  if (status === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "expiring_soon") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "invalid_or_expired_token" || status === "missing_scope" || status === "asset_not_assigned" || status === "wrong_account_id" || status === "platform_mismatch") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600"; // api_request_failed / never checked
}

export default function AdminSocialMedia() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"overview" | "campaigns" | "media" | "scheduled" | "published" | "failed" | "connections">("overview");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const assetsQuery = useQuery({
    queryKey: ["social-media-assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_media_assets").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as SocialAsset[];
    },
    enabled: !!session,
  });

  const campaignsQuery = useQuery({
    queryKey: ["social-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as SocialCampaign[];
    },
    enabled: !!session,
  });

  const accountsQuery = useQuery({
    queryKey: ["social-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_accounts").select("*").order("platform", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as SocialAccount[];
    },
    enabled: !!session,
  });

  const variantsQuery = useQuery({
    queryKey: ["social-platform-variants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_platform_variants").select("*");
      if (error) throw new Error(error.message);
      return (data || []) as SocialPlatformVariant[];
    },
    enabled: !!session,
  });

  const postsQuery = useQuery({
    queryKey: ["social-scheduled-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_scheduled_posts")
        .select("*, campaign:social_campaigns(name), asset:social_media_assets(title, storage_path)")
        .order("scheduled_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as (SocialScheduledPost & { campaign: { name: string } | null; asset: { title: string; storage_path: string } | null })[];
    },
    enabled: !!session,
  });

  const assets = assetsQuery.data || [];
  const campaigns = campaignsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const variants = variantsQuery.data || [];
  const posts = postsQuery.data || [];

  const scheduledPosts = useMemo(() => posts.filter((p) => p.status === "scheduled" || p.status === "publishing"), [posts]);
  const publishedPosts = useMemo(() => posts.filter((p) => p.status === "published"), [posts]);
  const failedPosts = useMemo(() => posts.filter((p) => p.status === "failed"), [posts]);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["social-media-assets"] });
    queryClient.invalidateQueries({ queryKey: ["social-campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["social-platform-variants"] });
    queryClient.invalidateQueries({ queryKey: ["social-scheduled-posts"] });
  };

  const overdueDueSoonCount = useMemo(
    () => scheduledPosts.filter((p) => new Date(p.scheduled_at).getTime() <= Date.now() + 24 * 60 * 60 * 1000).length,
    [scheduledPosts],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-5 md:px-5 md:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Social Media</h1>
          <p className="text-sm text-muted-foreground">
            Poster campaigns for Facebook and Instagram - upload once, approve once, publish automatically every few days.
          </p>
        </div>
        <Button variant="outline" onClick={refetchAll} disabled={assetsQuery.isFetching || campaignsQuery.isFetching || postsQuery.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${assetsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="overview"><Megaphone className="mr-1.5 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="campaigns"><Calendar className="mr-1.5 h-4 w-4" />Campaigns</TabsTrigger>
          <TabsTrigger value="media"><ImageIcon className="mr-1.5 h-4 w-4" />Media Library</TabsTrigger>
          <TabsTrigger value="scheduled"><Clock3 className="mr-1.5 h-4 w-4" />Scheduled ({scheduledPosts.length})</TabsTrigger>
          <TabsTrigger value="published"><CheckCircle2 className="mr-1.5 h-4 w-4" />Published ({publishedPosts.length})</TabsTrigger>
          <TabsTrigger value="failed"><XCircle className="mr-1.5 h-4 w-4" />Failed ({failedPosts.length})</TabsTrigger>
          <TabsTrigger value="connections"><Settings className="mr-1.5 h-4 w-4" />Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel
            campaigns={campaigns}
            accounts={accounts}
            scheduledCount={scheduledPosts.length}
            publishedCount={publishedPosts.length}
            failedCount={failedPosts.length}
            dueSoonCount={overdueDueSoonCount}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsPanel
            campaigns={campaigns}
            assets={assets}
            accounts={accounts}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
            accessToken={session?.access_token || ""}
            onChanged={refetchAll}
          />
        </TabsContent>

        <TabsContent value="media">
          <MediaLibraryPanel assets={assets} variants={variants} userId={session?.user.id || ""} accessToken={session?.access_token || ""} onChanged={refetchAll} />
        </TabsContent>

        <TabsContent value="scheduled">
          <PostsTable title="Scheduled Posts" emptyMessage="No posts are currently scheduled." posts={scheduledPosts} onChanged={refetchAll} showRetry={false} />
        </TabsContent>

        <TabsContent value="published">
          <PostsTable title="Published Posts" emptyMessage="Nothing has published yet." posts={publishedPosts} onChanged={refetchAll} showRetry={false} />
        </TabsContent>

        <TabsContent value="failed">
          <PostsTable title="Failed Posts" emptyMessage="No failed posts - nice." posts={failedPosts} onChanged={refetchAll} showRetry />
        </TabsContent>

        <TabsContent value="connections">
          <ConnectionsPanel accounts={accounts} accessToken={session?.access_token || ""} onChanged={refetchAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewPanel({ campaigns, accounts, scheduledCount, publishedCount, failedCount, dueSoonCount }: {
  campaigns: SocialCampaign[];
  accounts: SocialAccount[];
  scheduledCount: number;
  publishedCount: number;
  failedCount: number;
  dueSoonCount: number;
}) {
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const unhealthyAccounts = accounts.filter((a) => a.last_health_check_status && a.last_health_check_status !== "connected").length;

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-900">Production safety switch</p>
            <p className="text-amber-800">
              Automatic publishing is controlled by the <code className="rounded bg-amber-100 px-1">SOCIAL_AUTO_PUBLISH_ENABLED</code> secret on the edge
              function. While it is <code className="rounded bg-amber-100 px-1">false</code>, the scheduler will identify due posts every 5 minutes but
              will never publish anything.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active campaigns" value={activeCampaigns} icon={Megaphone} />
        <StatCard label="Due within 24h" value={dueSoonCount} icon={Clock3} />
        <StatCard label="Published" value={publishedCount} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Failed" value={failedCount} icon={XCircle} tone={failedCount ? "red" : undefined} />
        <StatCard label="Accounts needing attention" value={unhealthyAccounts} icon={ShieldCheck} tone={unhealthyAccounts ? "amber" : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent campaigns</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet. Create one under Campaigns.</p>
          ) : (
            campaigns.slice(0, 6).map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-semibold">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Starts {formatInBusinessTimezone(campaign.start_at)} - every {campaign.interval_days} day{campaign.interval_days === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant="outline" className={campaignStatusBadgeClass(campaign.status)}>{campaign.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Scheduled posts: {scheduledCount}. Business timezone: {BUSINESS_TIMEZONE}.</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Megaphone; tone?: "emerald" | "red" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${toneClass}`} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Media Library
// ---------------------------------------------------------------------------

type VariantBadgeStatus = "ready_original" | "ready_variant" | "needs_variant" | "needs_manual_adjustment";
type VariantBadge = { platform: SocialPlatform; status: VariantBadgeStatus; variant: SocialPlatformVariant | null };

const VARIANT_BADGE_LABEL: Record<VariantBadgeStatus, string> = {
  ready_original: "Ready (original)",
  ready_variant: "Ready (variant)",
  needs_variant: "Needs variant",
  needs_manual_adjustment: "Needs manual adjustment",
};

function variantBadgeClass(status: VariantBadgeStatus) {
  if (status === "ready_original" || status === "ready_variant") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "needs_variant") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700"; // needs_manual_adjustment
}

// Predicts, before generation runs, what the Media Library badge should say
// for one asset/platform pair. The original is preferred whenever it
// already passes; a saved variant is used next; otherwise this predicts
// (via the same contain-layout math the generator uses) whether an
// automatic variant would be safe, so "needs manual adjustment" shows up
// even before anyone clicks "Generate platform versions".
function variantBadgeForAsset(asset: SocialAsset, platform: SocialPlatform, variants: SocialPlatformVariant[]): VariantBadge {
  const platformKey = PLATFORM_TO_RULE_KEY[platform];
  const originalValidation = validateAssetForPlatform(assetForValidation(asset), platformKey);
  if (originalValidation.valid) return { platform, status: "ready_original", variant: null };

  const variant = variants.find((v) => v.media_asset_id === asset.id && v.platform === platform) || null;
  if (variant) {
    const variantValidation = validateAssetForPlatform(
      { mimeType: variant.mime_type, width: variant.width_px, height: variant.height_px, fileSizeBytes: variant.file_size_bytes },
      platformKey,
    );
    return { platform, status: variantValidation.valid ? "ready_variant" : "needs_manual_adjustment", variant };
  }

  const target = platform === "instagram" ? chooseInstagramFeedTarget(asset.width_px, asset.height_px) : FACEBOOK_FALLBACK_TARGET;
  const layout = computeContainLayout(asset.width_px, asset.height_px, target);
  return { platform, status: needsManualAdjustment(layout) ? "needs_manual_adjustment" : "needs_variant", variant: null };
}

function MediaLibraryPanel({ assets, variants, userId, accessToken, onChanged }: {
  assets: SocialAsset[];
  variants: SocialPlatformVariant[];
  userId: string;
  accessToken: string;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [generatingAssetId, setGeneratingAssetId] = useState<string | null>(null);

  const visibleAssets = assets.filter((asset) => (showArchived ? asset.status === "archived" : asset.status === "active"));

  const loadPreview = async (asset: SocialAsset) => {
    if (previewUrls[asset.id]) return;
    const url = await getSocialAssetPreviewUrl(asset.storage_path);
    if (url) setPreviewUrls((current) => ({ ...current, [asset.id]: url }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !userId) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    let succeeded = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadSocialMediaAsset({ file, title: file.name.replace(/\.[^.]+$/, ""), createdBy: userId });
        succeeded++;
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
      }
      setUploadProgress((current) => (current ? { done: current.done + 1, total: current.total } : current));
    }
    setUploading(false);
    setUploadProgress(null);
    if (succeeded) {
      toast.success(`Uploaded ${succeeded} poster${succeeded === 1 ? "" : "s"}`);
      onChanged();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const archiveAsset = async (asset: SocialAsset, archive: boolean) => {
    const { error } = await supabase.from("social_media_assets").update({ status: archive ? "archived" : "active" }).eq("id", asset.id);
    if (error) return toast.error(error.message);
    toast.success(archive ? "Asset archived" : "Asset restored");
    onChanged();
  };

  const updateAssetField = async (asset: SocialAsset, field: "title" | "default_caption", value: string) => {
    const { error } = await supabase.from("social_media_assets").update({ [field]: value || null }).eq("id", asset.id);
    if (error) toast.error(error.message);
  };

  const generatePlatformVersions = async (asset: SocialAsset) => {
    setGeneratingAssetId(asset.id);
    try {
      const response = await fetch(SOCIAL_GENERATE_VARIANTS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ media_asset_ids: [asset.id] }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Failed to generate platform versions");
        return;
      }
      const results = (payload.results || []) as { platform: string; status: string; message?: string }[];
      const generated = results.filter((r) => r.status === "generated").length;
      const manual = results.filter((r) => r.status === "needs_manual_adjustment");
      const errored = results.filter((r) => r.status === "error");
      if (generated) toast.success(`Generated ${generated} platform version${generated === 1 ? "" : "s"} for "${asset.title}"`);
      manual.forEach((r) => toast.warning(`${r.platform}: ${r.message || "needs manual adjustment"}`));
      errored.forEach((r) => toast.error(`${r.platform}: ${r.message || "generation failed"}`));
      if (!generated && !manual.length && !errored.length) toast.info("Already valid for every platform - no variant needed.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate platform versions");
    } finally {
      setGeneratingAssetId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Upload posters</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>{showArchived ? "Show active" : "Show archived"}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {uploading && uploadProgress ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...` : "Upload posters (JPEG/PNG, up to 15MB each)"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleAssets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{showArchived ? "No archived assets." : "No posters uploaded yet."}</p>
        ) : (
          visibleAssets.map((asset) => {
            const badges = (["facebook", "instagram"] as SocialPlatform[]).map((platform) => variantBadgeForAsset(asset, platform, variants));
            const anyNeedsGeneration = badges.some((b) => b.status === "needs_variant");
            return (
              <Card key={asset.id} className="overflow-hidden">
                <button type="button" className="block aspect-video w-full bg-muted" onClick={() => loadPreview(asset)}>
                  {previewUrls[asset.id] ? (
                    <img src={previewUrls[asset.id]} alt={asset.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>
                  )}
                </button>
                <CardContent className="space-y-2 p-3">
                  <Input
                    defaultValue={asset.title}
                    className="h-8 text-sm font-semibold"
                    onBlur={(e) => e.target.value !== asset.title && updateAssetField(asset, "title", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Original: {asset.width_px}x{asset.height_px}px - {fileSizeLabel(asset.file_size_bytes)} - {asset.mime_type.replace("image/", "").toUpperCase()}
                  </p>
                  <Textarea
                    defaultValue={asset.default_caption || ""}
                    placeholder="Default caption for this poster (optional)"
                    className="min-h-[52px] text-xs"
                    onBlur={(e) => e.target.value !== (asset.default_caption || "") && updateAssetField(asset, "default_caption", e.target.value)}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((badge) => (
                      <Badge key={badge.platform} variant="outline" className={variantBadgeClass(badge.status)}>
                        {PLATFORM_LABELS[badge.platform]}: {VARIANT_BADGE_LABEL[badge.status]}
                        {badge.variant ? ` (${badge.variant.width_px}x${badge.variant.height_px})` : ""}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!anyNeedsGeneration || generatingAssetId === asset.id}
                    onClick={() => generatePlatformVersions(asset)}
                  >
                    {generatingAssetId === asset.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                    Generate platform versions
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => archiveAsset(asset, asset.status === "active")}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />{asset.status === "active" ? "Archive" : "Restore"}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

type PreviewSlot = {
  campaign_item_id: string;
  media_asset_id: string;
  target_platform: SocialPlatform;
  scheduled_at: string;
  local_date: string;
  shifted_for_exclusion: boolean;
  caption: string;
};
type ValidationIssue = { campaign_item_id: string; platform: string; failures: { code: string; message: string }[] };

function CampaignsPanel({ campaigns, assets, accounts, selectedCampaignId, onSelectCampaign, accessToken, onChanged }: {
  campaigns: SocialCampaign[];
  assets: SocialAsset[];
  accounts: SocialAccount[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
  accessToken: string;
  onChanged: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) || null;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campaigns</CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="mr-1.5 h-4 w-4" />New</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => onSelectCampaign(campaign.id)}
                className={`block w-full rounded-lg border p-3 text-left ${selectedCampaignId === campaign.id ? "border-primary bg-primary/5" : "bg-background"}`}
              >
                <p className="truncate text-sm font-semibold">{campaign.name}</p>
                <Badge variant="outline" className={`mt-1 ${campaignStatusBadgeClass(campaign.status)}`}>{campaign.status}</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selectedCampaign ? (
        <CampaignDetail campaign={selectedCampaign} assets={assets} accounts={accounts} accessToken={accessToken} onChanged={onChanged} />
      ) : (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Select a campaign, or create a new one.</CardContent></Card>
      )}

      <CreateCampaignDialog open={showCreate} onOpenChange={setShowCreate} onCreated={(id) => { onChanged(); onSelectCampaign(id); }} />
    </div>
  );
}

function CreateCampaignDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [intervalDays, setIntervalDays] = useState("3");
  const [platforms, setPlatforms] = useState<Set<SocialPlatform>>(new Set(["facebook", "instagram"]));
  const [captionTemplate, setCaptionTemplate] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [saving, setSaving] = useState(false);

  const togglePlatform = (platform: SocialPlatform) => {
    setPlatforms((current) => {
      const next = new Set(current);
      if (next.has(platform)) next.delete(platform); else next.add(platform);
      return next;
    });
  };

  const submit = async () => {
    if (!session?.user.id) return;
    if (!name.trim()) return toast.error("Campaign name is required");
    const startInstant = startAt ? parseLocalDateTimeInZone(startAt, BUSINESS_TIMEZONE) : null;
    if (!startInstant) return toast.error("Pick a start date and time");
    if (platforms.size === 0) return toast.error("Select at least one target platform");

    setSaving(true);
    const { data, error } = await supabase
      .from("social_campaigns")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        start_at: startInstant.toISOString(),
        timezone: BUSINESS_TIMEZONE,
        interval_days: Number(intervalDays) || 3,
        target_platforms: Array.from(platforms),
        default_caption_template: captionTemplate.trim() || null,
        default_hashtags: hashtags.split(",").map((tag) => tag.trim()).filter(Boolean),
        created_by: session.user.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message || "Unable to create campaign");
    toast.success("Campaign created as draft");
    onOpenChange(false);
    onCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Campaign name (e.g. Acapolite SARS Awareness Campaign)" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Start (Africa/Johannesburg time)
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1" />
            </label>
            <label className="text-xs text-muted-foreground">
              Interval (days)
              <Input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className="mt-1" />
            </label>
          </div>
          <div className="flex gap-4">
            {(["facebook", "instagram"] as SocialPlatform[]).map((platform) => (
              <label key={platform} className="flex items-center gap-2 text-sm">
                <Checkbox checked={platforms.has(platform)} onCheckedChange={() => togglePlatform(platform)} />
                {PLATFORM_LABELS[platform]}
              </label>
            ))}
          </div>
          <Textarea placeholder="Default caption template (optional - each poster can override this)" value={captionTemplate} onChange={(e) => setCaptionTemplate(e.target.value)} />
          <Input placeholder="Default hashtags, comma separated (optional)" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDetail({ campaign, assets, accounts, accessToken, onChanged }: {
  campaign: SocialCampaign;
  assets: SocialAsset[];
  accounts: SocialAccount[];
  accessToken: string;
  onChanged: () => void;
}) {
  const [previewSlots, setPreviewSlots] = useState<PreviewSlot[] | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [excludedDateInput, setExcludedDateInput] = useState("");

  const itemsQuery = useQuery({
    queryKey: ["social-campaign-items", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_campaign_items").select("*").eq("campaign_id", campaign.id).order("position", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []) as SocialCampaignItem[];
    },
  });

  const excludedQuery = useQuery({
    queryKey: ["social-campaign-excluded-dates", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_campaign_excluded_dates").select("*").eq("campaign_id", campaign.id).order("excluded_date");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const items = itemsQuery.data || [];
  const excludedDates = excludedQuery.data || [];
  const isDraft = campaign.status === "draft";
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const refetchLocal = () => {
    itemsQuery.refetch();
    excludedQuery.refetch();
  };

  const addAsset = async (assetId: string) => {
    if (!assetId || items.some((item) => item.media_asset_id === assetId)) return;
    const { error } = await supabase.from("social_campaign_items").insert({ campaign_id: campaign.id, media_asset_id: assetId, position: items.length });
    if (error) return toast.error(error.message);
    refetchLocal();
  };

  const removeItem = async (item: SocialCampaignItem) => {
    const { error } = await supabase.from("social_campaign_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    // Re-pack positions so there are no gaps.
    const remaining = items.filter((i) => i.id !== item.id).sort((a, b) => a.position - b.position);
    await Promise.all(remaining.map((row, index) => supabase.from("social_campaign_items").update({ position: index }).eq("id", row.id)));
    refetchLocal();
  };

  const moveItem = async (item: SocialCampaignItem, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((i) => i.id === item.id);
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    const other = sorted[swapIndex];
    await Promise.all([
      supabase.from("social_campaign_items").update({ position: other.position }).eq("id", item.id),
      supabase.from("social_campaign_items").update({ position: item.position }).eq("id", other.id),
    ]);
    refetchLocal();
  };

  const updateCaptionOverride = async (item: SocialCampaignItem, value: string) => {
    const { error } = await supabase.from("social_campaign_items").update({ caption_override: value || null }).eq("id", item.id);
    if (error) toast.error(error.message);
  };

  const addExcludedDate = async () => {
    if (!excludedDateInput) return;
    const { error } = await supabase.from("social_campaign_excluded_dates").insert({ campaign_id: campaign.id, excluded_date: excludedDateInput });
    if (error) return toast.error(error.message);
    setExcludedDateInput("");
    refetchLocal();
  };

  const removeExcludedDate = async (id: string) => {
    await supabase.from("social_campaign_excluded_dates").delete().eq("id", id);
    refetchLocal();
  };

  const callActivateFunction = async (action: "preview" | "activate") => {
    setBusy(true);
    try {
      const response = await fetch(SOCIAL_CAMPAIGN_ACTIVATE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, campaign_id: campaign.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setValidationIssues(payload.validation_issues || []);
        toast.error(payload.error || `${action} failed`);
        return;
      }
      if (action === "preview") {
        setPreviewSlots(payload.slots || []);
        setValidationIssues(payload.validation_issues || []);
        toast.success(`Preview ready: ${payload.slots?.length || 0} post(s) would be scheduled`);
      } else {
        toast.success(`Campaign activated: ${payload.scheduled_count} post(s) scheduled`);
        onChanged();
      }
    } catch {
      toast.error(`Unable to reach the ${action} service`);
    } finally {
      setBusy(false);
    }
  };

  const approveCampaign = async () => {
    if (!items.length) return toast.error("Add at least one poster before approving");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("social_campaigns").update({
      status: "approved", approved_by: userData.user?.id, approved_at: new Date().toISOString(),
    }).eq("id", campaign.id);
    if (error) return toast.error(error.message);
    toast.success("Campaign approved. Activate it when you're ready to start posting.");
    onChanged();
  };

  const setPaused = async (paused: boolean) => {
    const { error } = await supabase.from("social_campaigns").update({
      status: paused ? "paused" : "active",
      paused_at: paused ? new Date().toISOString() : null,
    }).eq("id", campaign.id);
    if (error) return toast.error(error.message);
    toast.success(paused ? "Campaign paused - no due posts will publish" : "Campaign resumed");
    onChanged();
  };

  const missingAccounts = campaign.target_platforms.filter((platform) => !accounts.some((a) => a.platform === platform && a.is_active));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Starts {formatInBusinessTimezone(campaign.start_at)} - every {campaign.interval_days} day{campaign.interval_days === 1 ? "" : "s"} - {campaign.target_platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
            </p>
          </div>
          <Badge variant="outline" className={campaignStatusBadgeClass(campaign.status)}>{campaign.status}</Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => callActivateFunction("preview")} disabled={busy || !items.length}>Preview schedule</Button>
          {isDraft ? <Button size="sm" onClick={approveCampaign} disabled={busy || !items.length}>Approve</Button> : null}
          {campaign.status === "approved" ? (
            <Button size="sm" onClick={() => callActivateFunction("activate")} disabled={busy || missingAccounts.length > 0}>
              <Play className="mr-1.5 h-4 w-4" />Activate
            </Button>
          ) : null}
          {campaign.status === "active" ? (
            <Button size="sm" variant="destructive" onClick={() => setPaused(true)}><Pause className="mr-1.5 h-4 w-4" />Pause</Button>
          ) : null}
          {campaign.status === "paused" ? (
            <Button size="sm" onClick={() => setPaused(false)}><Play className="mr-1.5 h-4 w-4" />Resume</Button>
          ) : null}
        </CardContent>
        {missingAccounts.length > 0 ? (
          <CardContent className="pt-0">
            <p className="text-xs text-red-700">Missing connected account(s) for: {missingAccounts.map((p) => PLATFORM_LABELS[p]).join(", ")}. Connect them under Connections.</p>
          </CardContent>
        ) : null}
      </Card>

      {validationIssues.length > 0 ? (
        <Card className="border-red-200 bg-red-50/60">
          <CardHeader><CardTitle className="text-sm text-red-800">Posters failing platform validation</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-red-800">
            {validationIssues.map((issue, index) => (
              <p key={index}>{PLATFORM_LABELS[issue.platform as SocialPlatform] || issue.platform}: {issue.failures.map((f) => f.message).join(" ")}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {previewSlots ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Dry-run schedule preview</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs">
            {previewSlots.map((slot, index) => (
              <p key={index}>
                Poster {index + 1} ({PLATFORM_LABELS[slot.target_platform]}): {formatInBusinessTimezone(slot.scheduled_at)}
                {slot.shifted_for_exclusion ? " (shifted past an excluded date)" : ""}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Posters ({items.length})</CardTitle>
          {isDraft ? (
            <Select onValueChange={addAsset}>
              <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Add a poster..." /></SelectTrigger>
              <SelectContent>
                {assets.filter((a) => a.status === "active" && !items.some((item) => item.media_asset_id === a.id)).map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>{asset.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? <p className="text-sm text-muted-foreground">No posters added yet.</p> : null}
          {items.sort((a, b) => a.position - b.position).map((item, index) => {
            const asset = assetById.get(item.media_asset_id);
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex flex-col items-center gap-1 pt-1 text-xs text-muted-foreground">
                  <span>#{index + 1}</span>
                  {isDraft ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(item, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(item, 1)} disabled={index === items.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-semibold">{asset?.title || "Unknown asset"}</p>
                  <Textarea
                    defaultValue={item.caption_override || ""}
                    placeholder="Caption for this poster (overrides the campaign default)"
                    className="min-h-[48px] text-xs"
                    disabled={!isDraft}
                    onBlur={(e) => e.target.value !== (item.caption_override || "") && updateCaptionOverride(item, e.target.value)}
                  />
                </div>
                {isDraft ? <Button variant="ghost" size="icon" onClick={() => removeItem(item)}><Trash2 className="h-4 w-4" /></Button> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Excluded dates</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {excludedDates.map((row) => (
              <Badge key={row.id} variant="outline" className="gap-1">
                {row.excluded_date}
                {isDraft ? <button type="button" onClick={() => removeExcludedDate(row.id)}><XCircle className="h-3 w-3" /></button> : null}
              </Badge>
            ))}
          </div>
          {isDraft ? (
            <div className="flex gap-2">
              <Input type="date" value={excludedDateInput} onChange={(e) => setExcludedDateInput(e.target.value)} className="w-48" />
              <Button variant="outline" size="sm" onClick={addExcludedDate}>Add excluded date</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scheduled / Published / Failed posts (shared table)
// ---------------------------------------------------------------------------

type PostRow = SocialScheduledPost & { campaign: { name: string } | null; asset: { title: string; storage_path: string } | null };

function PostsTable({ title, emptyMessage, posts, onChanged, showRetry }: {
  title: string;
  emptyMessage: string;
  posts: PostRow[];
  onChanged: () => void;
  showRetry: boolean;
}) {
  const [rescheduling, setRescheduling] = useState<PostRow | null>(null);

  const retryPost = async (post: PostRow) => {
    const { error } = await supabase.from("social_scheduled_posts").update({
      status: "scheduled",
      next_retry_at: null,
      failure_code: null,
      failure_message: null,
      claimed_at: null,
      claimed_by: null,
    }).eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Post re-queued for the next scheduler run");
    onChanged();
  };

  const cancelPost = async (post: PostRow) => {
    const { error } = await supabase.from("social_scheduled_posts").update({ status: "cancelled" }).eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Post cancelled");
    onChanged();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {posts.length === 0 ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null}
        {posts.map((post) => (
          <div key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold">{post.campaign?.name || "Unknown campaign"} - {post.asset?.title || "Unknown poster"}</p>
                <Badge variant="outline" className={postStatusBadgeClass(post.status)}>{post.status}</Badge>
                <Badge variant="outline">{PLATFORM_LABELS[post.target_platform]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {post.status === "published" ? `Published ${post.published_at ? formatInBusinessTimezone(post.published_at) : ""}` : `Scheduled ${formatInBusinessTimezone(post.scheduled_at)}`}
                {post.attempt_count > 0 ? ` - ${post.attempt_count} attempt(s)` : ""}
              </p>
              {post.status === "failed" ? (
                <p className="mt-1 text-xs text-red-700">{post.failure_code}: {post.failure_message}</p>
              ) : null}
              {post.status === "published" && post.provider_permalink ? (
                <a href={post.provider_permalink} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-primary underline">
                  View on {PLATFORM_LABELS[post.target_platform]}<ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
            <div className="flex gap-2">
              {showRetry ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setRescheduling(post)}>Edit &amp; retry</Button>
                  <Button size="sm" onClick={() => retryPost(post)}>Retry</Button>
                </>
              ) : null}
              {post.status === "scheduled" ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setRescheduling(post)}>Reschedule</Button>
                  <Button variant="ghost" size="sm" onClick={() => cancelPost(post)}>Cancel</Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
      {rescheduling ? (
        <ReschedulePostDialog
          post={rescheduling}
          onClose={() => setRescheduling(null)}
          onSaved={() => { setRescheduling(null); onChanged(); }}
        />
      ) : null}
    </Card>
  );
}

function ReschedulePostDialog({ post, onClose, onSaved }: { post: PostRow; onClose: () => void; onSaved: () => void }) {
  const [scheduledAt, setScheduledAt] = useState(toLocalDateTimeInputValue(new Date(post.scheduled_at), BUSINESS_TIMEZONE));
  const [caption, setCaption] = useState(post.caption);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const instant = parseLocalDateTimeInZone(scheduledAt, BUSINESS_TIMEZONE);
    if (!instant) return toast.error("Pick a valid date and time");
    setSaving(true);
    const { error } = await supabase.from("social_scheduled_posts").update({
      scheduled_at: instant.toISOString(),
      caption,
      status: "scheduled",
      next_retry_at: null,
      failure_code: null,
      failure_message: null,
      claimed_at: null,
      claimed_by: null,
    }).eq("id", post.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Post updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit post</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="text-xs text-muted-foreground">
            Scheduled time (Africa/Johannesburg)
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1" />
          </label>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-[100px]" />
          <p className="text-xs text-muted-foreground">Only this post is affected - the rest of the campaign's schedule is unchanged.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Connections / Settings
// ---------------------------------------------------------------------------

type DiscoveredPage = { id: string; name: string; instagram_business_account: { id: string; username?: string } | null };
type HealthCheckSummary = {
  results: { account_id: string; provider_account_id: string; corrected: { from: string; to: string } | null; status: string; message: string }[];
  token_scopes: string[];
  token_granular_scopes: { scope: string; target_ids?: string[] }[];
  discovered_pages: DiscoveredPage[];
  discovery_error: string | null;
};

function ConnectionsPanel({ accounts, accessToken, onChanged }: { accounts: SocialAccount[]; accessToken: string; onChanged: () => void }) {
  const [checking, setChecking] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [lastCheck, setLastCheck] = useState<HealthCheckSummary | null>(null);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const response = await fetch(SOCIAL_CONNECTION_HEALTH_URL, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Health check failed");
      } else {
        setLastCheck(payload);
        const corrections = (payload.results || []).filter((r: { corrected: unknown }) => r.corrected).length;
        toast.success(`Checked ${payload.results?.length || 0} account(s)${corrections ? ` - corrected ${corrections} account ID(s)` : ""}`);
        onChanged();
      }
    } catch {
      toast.error("Unable to reach the health check service");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={checkHealth} disabled={checking || !accounts.length}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Check token health
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="mr-1.5 h-4 w-4" />Connect account</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts connected yet. Facebook Page and Instagram Business account IDs must be added here before a campaign can target them.</p>
          ) : (
            accounts.map((account) => <AccountRow key={account.id} account={account} onChanged={onChanged} />)
          )}
        </CardContent>
      </Card>

      {lastCheck ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Last check details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {lastCheck.results.filter((r) => r.corrected).map((r) => (
              <p key={r.account_id} className="text-emerald-700">
                Corrected account ID: <code className="rounded bg-emerald-50 px-1">{r.corrected!.from}</code> -&gt; <code className="rounded bg-emerald-50 px-1">{r.corrected!.to}</code>
              </p>
            ))}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Token scopes returned by Meta</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {lastCheck.token_scopes.length === 0 && lastCheck.token_granular_scopes.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None returned - check META_ACCESS_TOKEN.</span>
                ) : (
                  dedupeScopeDisplay(lastCheck.token_scopes, lastCheck.token_granular_scopes).map(({ scope, targetCount }) => (
                    <Badge key={scope} variant="outline" className={targetCount > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : undefined}>
                      {scope}{targetCount > 0 ? ` (${targetCount} asset${targetCount === 1 ? "" : "s"})` : ""}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            {lastCheck.discovered_pages.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pages discovered from META_ACCESS_TOKEN</p>
                {lastCheck.discovered_pages.map((page) => (
                  <p key={page.id} className="mt-1 text-xs">
                    <span className="font-semibold">{page.name}</span> - Page ID: <code className="rounded bg-muted px-1">{page.id}</code>
                    {page.instagram_business_account ? <> - IG Business Account ID: <code className="rounded bg-muted px-1">{page.instagram_business_account.id}</code></> : " - no linked Instagram Business account"}
                  </p>
                ))}
              </div>
            ) : lastCheck.discovery_error ? (
              <p className="text-xs text-red-700">Discovery error: {lastCheck.discovery_error}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-sky-200 bg-sky-50/60">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
          <div className="text-sky-900">
            <p className="font-semibold">Secrets required (set once, never shown here)</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              <li><code>META_ACCESS_TOKEN</code> - a Page-scoped token with pages_manage_posts, pages_read_engagement, instagram_content_publish, instagram_basic, pages_show_list</li>
              <li><code>META_GRAPH_API_VERSION</code> - e.g. v21.0</li>
              <li><code>SOCIAL_CRON_SECRET</code> - internal only, already generated</li>
              <li><code>SOCIAL_AUTO_PUBLISH_ENABLED</code> - keep as <code>false</code> until you've approved a manual test post</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <AddAccountDialog open={showAdd} onOpenChange={setShowAdd} onAdded={onChanged} />

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-900">
          <Bot className="h-4 w-4 shrink-0" />
          LinkedIn Company Page publishing is architecturally supported (provider interface + validation rules exist) but not yet implemented. No LinkedIn credentials are requested until it is built.
        </CardContent>
      </Card>
    </div>
  );
}

type AccountDependencySummary = { total: number; byStatus: Record<string, number> };

async function loadAccountDependencies(accountId: string): Promise<AccountDependencySummary> {
  const { data, error } = await supabase.from("social_scheduled_posts").select("status").eq("social_account_id", accountId);
  if (error || !data) return { total: 0, byStatus: {} };
  const byStatus: Record<string, number> = {};
  for (const row of data) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  return { total: data.length, byStatus };
}

function AccountRow({ account, onChanged }: { account: SocialAccount; onChanged: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dependencies, setDependencies] = useState<AccountDependencySummary | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [busy, setBusy] = useState(false);

  const disconnect = async () => {
    setBusy(true);
    const { error } = await supabase.from("social_accounts").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", account.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logSocialActivity("social_account_disconnected", account.id, { platform: account.platform, provider_account_id: account.provider_account_id, display_name: account.display_name });
    toast.success(`${account.display_name} disconnected. It will no longer be used for new campaign activations.`);
    onChanged();
  };

  const reconnect = async () => {
    setBusy(true);
    const { error } = await supabase.from("social_accounts").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", account.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await logSocialActivity("social_account_reconnected", account.id, { platform: account.platform, provider_account_id: account.provider_account_id, display_name: account.display_name });
    toast.success(`${account.display_name} reconnected.`);
    onChanged();
  };

  const openDeleteConfirm = async () => {
    setCheckingDeps(true);
    setConfirmOpen(true);
    setDependencies(await loadAccountDependencies(account.id));
    setCheckingDeps(false);
  };

  const confirmDelete = async () => {
    setBusy(true);
    const { error } = await supabase.from("social_accounts").delete().eq("id", account.id);
    setBusy(false);
    setConfirmOpen(false);
    if (error) {
      // Defense in depth: even if the pre-check above raced with a new
      // scheduled post, the FK (social_scheduled_posts.social_account_id
      // references social_accounts ON DELETE RESTRICT) blocks the delete
      // at the database level and this surfaces that as a clear message.
      return toast.error(`Unable to delete this account: ${error.message}`);
    }
    await logSocialActivity("social_account_deleted", account.id, { platform: account.platform, provider_account_id: account.provider_account_id, display_name: account.display_name });
    toast.success(`${account.display_name} removed. This only deleted Acapolite's connection record - the Meta Page/Instagram account and system-user token are untouched.`);
    onChanged();
  };

  const blocked = (dependencies?.total || 0) > 0;

  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${account.is_active ? "" : "opacity-60"}`}>
      <div>
        <p className="text-sm font-semibold">
          {account.display_name} <span className="text-xs text-muted-foreground">({PLATFORM_LABELS[account.platform]})</span>
          {!account.is_active ? <Badge variant="outline" className="ml-2 border-slate-200 bg-slate-50 text-slate-600">disconnected</Badge> : null}
        </p>
        <p className="text-xs text-muted-foreground">Account ID: {account.provider_account_id}</p>
        {account.last_health_check_message ? <p className="text-xs text-muted-foreground">{account.last_health_check_message}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={healthBadgeClass(account.last_health_check_status)}>
          {account.last_health_check_status ? account.last_health_check_status.replace(/_/g, " ") : "never checked"}
        </Badge>
        {account.is_active ? (
          <Button variant="outline" size="sm" onClick={disconnect} disabled={busy} title="Disconnect (soft) - keeps the record, stops it being used for new campaigns">
            <Ban className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={reconnect} disabled={busy} title="Reconnect">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={openDeleteConfirm} disabled={busy} title="Delete connection record">
          <Trash2 className="h-3.5 w-3.5 text-red-600" />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {PLATFORM_LABELS[account.platform]} account "{account.display_name}"?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>This only deletes Acapolite's connection record (account ID {account.provider_account_id}). It never deletes the actual Facebook Page or Instagram account, never revokes the Meta system-user token, and never touches WhatsApp.</p>
                {checkingDeps ? (
                  <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking for dependent posts...</p>
                ) : blocked ? (
                  <p className="font-semibold text-red-700">
                    Blocked: {dependencies?.total} post(s) still reference this account
                    ({Object.entries(dependencies?.byStatus || {}).map(([status, count]) => `${count} ${status}`).join(", ")}).
                    Disconnect it instead, or wait until those posts are resolved.
                  </p>
                ) : (
                  <p>No scheduled or published posts reference this account - safe to delete.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={checkingDeps || blocked || busy} className="bg-red-600 hover:bg-red-700">
              Delete connection record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddAccountDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: () => void }) {
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [providerAccountId, setProviderAccountId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmedId = providerAccountId.trim();
    if (!trimmedId || !displayName.trim()) return toast.error("Account ID and display name are required");
    if (!/^[0-9]+$/.test(trimmedId)) {
      return toast.error("Account ID must be the numeric Meta Graph API ID (e.g. 111222333444555), not a facebook.com/instagram.com profile URL. Use \"Check token health\" to discover it automatically.");
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("social_accounts").insert({
      platform,
      provider_account_id: providerAccountId.trim(),
      display_name: displayName.trim(),
      connected_by: userData.user?.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Account connected");
    onOpenChange(false);
    setProviderAccountId("");
    setDisplayName("");
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Connect an account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={platform} onValueChange={(v) => setPlatform(v as SocialPlatform)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="facebook">Facebook Page</SelectItem>
              <SelectItem value="instagram">Instagram Business account</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Numeric account ID (e.g. 111222333444555) - NOT a facebook.com/instagram.com URL" value={providerAccountId} onChange={(e) => setProviderAccountId(e.target.value)} />
          {providerAccountId.trim() && !/^[0-9]+$/.test(providerAccountId.trim()) ? (
            <p className="text-xs text-red-700">This must be the numeric Graph API ID, not a profile URL. Run "Check token health" first - it lists the discovered numeric IDs for your connected Pages.</p>
          ) : null}
          <Input placeholder="Display name (e.g. Acapolite Consulting)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <p className="text-xs text-muted-foreground">This stores the account ID only. The access token comes from the META_ACCESS_TOKEN secret, never entered here.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
