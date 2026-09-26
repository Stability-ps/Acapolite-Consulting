import { Outlet } from "react-router-dom";
import { Scale } from "lucide-react";

export default function SarsOpportunityHubLayout() {
  return <div className="space-y-5">
    <div>
      <div className="flex items-center gap-2"><Scale className="h-6 w-6 text-primary" /><h1 className="font-display text-2xl font-bold">SARS Opportunity Hub</h1></div>
      <p className="mt-1 text-sm text-muted-foreground">Evidence-led SARS and tax opportunity discovery, review, qualification and conversion. Public records describe documented matters only; they do not automatically establish current non-compliance.</p>
    </div>
    <main className="min-w-0"><Outlet /></main>
  </div>;
}