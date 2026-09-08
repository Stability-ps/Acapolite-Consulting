import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaxKnowledgeLibraryPanel } from "@/components/dashboard/admin/TaxKnowledgeLibraryPanel";
import { PastCasesPanel } from "@/components/dashboard/admin/PastCasesPanel";
import { CorrespondenceTemplatesPanel } from "@/components/dashboard/admin/CorrespondenceTemplatesPanel";

export default function AdminAiKnowledge() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground mb-1">AI Knowledge</h1>
        <p className="text-muted-foreground font-body text-sm">
          Global Tax Knowledge Library and Past Case precedents used by Tax AI. Never linked to a specific client or
          case — client case documents stay in each case's own Documents tab.
        </p>
      </div>

      <Tabs defaultValue="tax-library">
        <TabsList className="rounded-xl">
          <TabsTrigger value="tax-library" className="rounded-lg">Tax Library</TabsTrigger>
          <TabsTrigger value="past-cases" className="rounded-lg">Past Cases</TabsTrigger>
          <TabsTrigger value="correspondence-templates" className="rounded-lg">Correspondence Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="tax-library" className="mt-6">
          <TaxKnowledgeLibraryPanel />
        </TabsContent>
        <TabsContent value="past-cases" className="mt-6">
          <PastCasesPanel />
        </TabsContent>
        <TabsContent value="correspondence-templates" className="mt-6">
          <CorrespondenceTemplatesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
