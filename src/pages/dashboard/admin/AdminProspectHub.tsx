import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Plus, RefreshCw, Search, Send, Target, Users, CalendarClock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Prospect = {
  id: string;
  company_name: string;
  sector: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  source_name: string | null;
  source_url: string | null;
  status: string;
  priority: string;
  score: number;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  do_not_contact: boolean;
  created_at: string;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  replied_count: number;
  bounced_count: number;
  created_at: string;
};

type Template = {
  id: string;
  name: string;
  subject: string;
  body_text: string;
  category: string;
  is_active: boolean;
};

const db = supabase as any;

export default function AdminProspectHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newProspectOpen, setNewProspectOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [province, setProvince] = useState("Gauteng");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");

  const prospectsQuery = useQuery({
    queryKey: ["prospect-hub-prospects"],
    queryFn: async () => {
      const { data, error } = await db.from("prospects").select("*").order("score", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Prospect[];
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["prospect-hub-campaigns"],
    queryFn: async () => {
      const { data, error } = await db.from("prospect_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["prospect-hub-templates"],
    queryFn: async () => {
      const { data, error } = await db.from("prospect_email_templates").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (prospectsQuery.data ?? []).filter((p) => {
      const matchesSearch = !q || [p.company_name, p.sector, p.city, p.province, p.email, p.phone].some((v) => v?.toLowerCase().includes(q));
      const matchesStatus = status === "all" || p.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [prospectsQuery.data, search, status]);

  const counts = useMemo(() => {
    const rows = prospectsQuery.data ?? [];
    return {
      total: rows.length,
      high: rows.filter((p) => p.priority === "high" || p.priority === "urgent" || p.score >= 70).length,
      contacted: rows.filter((p) => p.status !== "new").length,
      followUps: rows.filter((p) => p.next_follow_up_at && p.status !== "converted").length,
    };
  }, [prospectsQuery.data]);

  const createProspect = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("prospects").insert({
        company_name: companyName.trim(),
        sector: sector.trim() || null,
        province: province || null,
        city: city.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        source_url: sourceUrl.trim() || null,
        source_name: sourceUrl.trim() ? "manual-web" : "manual",
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Prospect added");
      setNewProspectOpen(false);
      setCompanyName(""); setSector(""); setCity(""); setEmail(""); setPhone(""); setSourceUrl("");
      await queryClient.invalidateQueries({ queryKey: ["prospect-hub-prospects"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Unable to add prospect"),
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const selectedProspects = (prospectsQuery.data ?? []).filter((p) => selected.has(p.id) && p.email && !p.do_not_contact);
      if (!selectedProspects.length) throw new Error("Select at least one prospect with an email address.");
      const { data: campaign, error } = await db.from("prospect_campaigns").insert({
        name: campaignName.trim() || "Prospect campaign",
        template_id: templateId || null,
        subject: campaignSubject.trim(),
        body_text: campaignBody,
        status: "draft",
        total_recipients: selectedProspects.length,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const recipients = selectedProspects.map((p) => ({ campaign_id: campaign.id, prospect_id: p.id, email: p.email }));
      const { error: recipientError } = await db.from("prospect_campaign_recipients").insert(recipients);
      if (recipientError) throw recipientError;
    },
    onSuccess: async () => {
      toast.success("Campaign created as draft");
      setCampaignOpen(false);
      setSelected(new Set());
      setCampaignName(""); setCampaignSubject(""); setCampaignBody(""); setTemplateId("");
      await queryClient.invalidateQueries({ queryKey: ["prospect-hub-campaigns"] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Unable to create campaign"),
  });

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const template = templatesQuery.data?.find((item) => item.id === id);
    if (template) {
      setCampaignSubject(template.subject);
      setCampaignBody(template.body_text);
      if (!campaignName) setCampaignName(template.name);
    }
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((p) => p.id)) : new Set());
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2"><Target className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold">Prospect Hub</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Discover, qualify, contact and convert businesses into Acapolite clients.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { void prospectsQuery.refetch(); void campaignsQuery.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Dialog open={newProspectOpen} onOpenChange={setNewProspectOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Prospect</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Prospect</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                <Input placeholder="Sector e.g. Construction" value={sector} onChange={(e) => setSector(e.target.value)} />
                <div className="grid grid-cols-2 gap-3"><Input placeholder="Province" value={province} onChange={(e) => setProvince(e.target.value)} /><Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <Input type="email" placeholder="Public business email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input placeholder="Public business phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input placeholder="Source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                <Button disabled={!companyName.trim() || createProspect.isPending} onClick={() => createProspect.mutate()}>Save Prospect</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total prospects", counts.total, Building2],
          ["High priority", counts.high, Target],
          ["Contacted", counts.contacted, CheckCircle2],
          ["Follow-ups", counts.followUps, CalendarClock],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="prospects">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="prospects">Prospects</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
        </TabsList>

        <TabsContent value="prospects" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-center">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search company, sector, city, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="new">New</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="follow_up">Follow-up</SelectItem><SelectItem value="interested">Interested</SelectItem><SelectItem value="qualified">Qualified</SelectItem><SelectItem value="converted">Converted</SelectItem></SelectContent></Select>
            <Button variant="outline" disabled={!selected.size} onClick={() => setCampaignOpen(true)}><Mail className="mr-2 h-4 w-4" />Create Campaign ({selected.size})</Button>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="p-3"><Checkbox checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))} onCheckedChange={(v) => toggleAll(Boolean(v))} /></th>
                    <th className="p-3">Company</th><th className="p-3">Sector</th><th className="p-3">Location</th><th className="p-3">Contact</th><th className="p-3">Status</th><th className="p-3">Score</th><th className="p-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3"><Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => setSelected((prev) => { const next=new Set(prev); if(v) next.add(p.id); else next.delete(p.id); return next; })} /></td>
                      <td className="p-3 font-medium">{p.company_name}</td>
                      <td className="p-3">{p.sector || "—"}</td>
                      <td className="p-3">{[p.city,p.province].filter(Boolean).join(", ") || "—"}</td>
                      <td className="p-3"><div>{p.email || "—"}</div><div className="text-xs text-muted-foreground">{p.phone || ""}</div></td>
                      <td className="p-3 capitalize">{p.status.replace("_"," ")}</td>
                      <td className="p-3"><span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">{p.score}</span></td>
                      <td className="p-3">{p.source_name || "Manual"}</td>
                    </tr>
                  ))}
                  {!prospectsQuery.isLoading && filtered.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No prospects yet. Add one manually now; automated daily discovery is the next build step.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Email campaigns</h2><p className="text-sm text-muted-foreground">Bulk outreach is prepared here. Sending will run through the queued sender service.</p></div><Button disabled={!selected.size} onClick={() => setCampaignOpen(true)}><Send className="mr-2 h-4 w-4" />New Campaign</Button></div>
            <div className="space-y-2">
              {(campaignsQuery.data ?? []).map((c) => <div key={c.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between"><div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.subject}</p></div><div className="flex gap-4 text-xs"><span>{c.total_recipients} recipients</span><span>{c.sent_count} sent</span><span>{c.replied_count} replies</span><span className="capitalize">{c.status}</span></div></div>)}
              {!campaignsQuery.data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No campaigns yet.</p> : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid gap-3 lg:grid-cols-2">
            {(templatesQuery.data ?? []).map((t) => <div key={t.id} className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">{t.name}</h3><span className="rounded-full bg-muted px-2 py-1 text-xs">{t.category}</span></div><p className="mt-2 text-sm font-medium">{t.subject}</p><p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.body_text}</p></div>)}
          </div>
        </TabsContent>

        <TabsContent value="discover">
          <div className="rounded-2xl border bg-card p-8 text-center">
            <Target className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 text-lg font-semibold">Automated Discovery Engine</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">This area will run the daily collection and enrichment jobs from approved public sources, deduplicate businesses, score them and insert new prospects here automatically.</p>
            <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3"><p className="font-medium">Treasury/eTenders</p><p className="text-xs text-muted-foreground">Source ingestion</p></div><div className="rounded-xl border p-3"><p className="font-medium">Public web</p><p className="text-xs text-muted-foreground">Contact enrichment</p></div><div className="rounded-xl border p-3"><p className="font-medium">Daily sync</p><p className="text-xs text-muted-foreground">Scheduled updates</p></div></div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create bulk email campaign</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{selected.size} prospects selected. Prospects without an email or marked do-not-contact are automatically excluded.</p>
            <Input placeholder="Campaign name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            <Select value={templateId} onValueChange={chooseTemplate}><SelectTrigger><SelectValue placeholder="Choose pitch template" /></SelectTrigger><SelectContent>{(templatesQuery.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Email subject" value={campaignSubject} onChange={(e) => setCampaignSubject(e.target.value)} />
            <Textarea className="min-h-56" value={campaignBody} onChange={(e) => setCampaignBody(e.target.value)} />
            <Button disabled={!campaignSubject.trim() || !campaignBody.trim() || createCampaign.isPending} onClick={() => createCampaign.mutate()}>Create Draft Campaign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
