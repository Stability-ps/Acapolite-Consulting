import { Button } from "@/components/ui/button";

export function SummaryCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-[#E7E7E7] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#102B46]">{title}</h3>
        <Button type="button" variant="outline" className="rounded-full" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="mt-4 text-sm text-slate-700">{children}</div>
    </div>
  );
}
