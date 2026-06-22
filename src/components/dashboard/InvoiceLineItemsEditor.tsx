import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceLineItemDraft } from "@/lib/invoiceUtils";
import { calculateLineItemTotal, formatCurrency } from "@/lib/invoiceUtils";

interface InvoiceLineItemsEditorProps {
  items: InvoiceLineItemDraft[];
  readOnly?: boolean;
  onChange?: (items: InvoiceLineItemDraft[]) => void;
}

export function InvoiceLineItemsEditor({
  items,
  readOnly = false,
  onChange,
}: InvoiceLineItemsEditorProps) {
  const updateItem = (index: number, field: keyof InvoiceLineItemDraft, value: string) => {
    if (!onChange) return;
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    onChange(nextItems);
  };

  // Generate stable key that doesn't change when item values change
  const getStableKey = (item: InvoiceLineItemDraft, index: number) => {
    return item.id || `item-${index}`;
  };

  const addItem = () => {
    if (!onChange) return;
    onChange([
      ...items,
      {
        service_item: "",
        quantity: "1",
        unit_price: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (!onChange) return;
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onChange(nextItems.length ? nextItems : [{ service_item: "", quantity: "1", unit_price: "" }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground font-body">Invoice Line Items</p>
          <p className="text-xs text-muted-foreground font-body">
            Add each billed service, quantity, and unit price.
          </p>
        </div>
        {!readOnly ? (
          <Button type="button" variant="outline" className="rounded-xl" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        {/* Column headers — desktop only; mobile uses inline labels per field */}
        <div
          className={`hidden gap-3 border-b border-border bg-accent/20 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:grid ${readOnly ? "md:grid-cols-[minmax(0,1.9fr)_110px_140px_140px]" : "md:grid-cols-[minmax(0,1.9fr)_110px_140px_140px_52px]"}`}
        >
          <p>Service Item</p>
          <p>Quantity</p>
          <p>Price</p>
          <p>Total</p>
        </div>
        <div className="divide-y divide-border">
          {items?.map((item, index) => (
            <div
              key={getStableKey(item, index)}
              className={`grid grid-cols-1 gap-3 px-4 py-4 md:gap-3 ${
                readOnly
                  ? "md:grid-cols-[minmax(0,1.9fr)_110px_140px_140px]"
                  : "md:grid-cols-[minmax(0,1.9fr)_110px_140px_140px_52px]"
              }`}
            >
              {readOnly ? (
                <>
                  <p className="text-sm text-foreground font-body">{item.service_item || "Service item"}</p>
                  <p className="text-sm text-foreground font-body">
                    <span className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                      Qty
                    </span>
                    {item.quantity || "1"}
                  </p>
                  <p className="text-sm text-foreground font-body">
                    <span className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                      Price
                    </span>
                    {formatCurrency(Number(item.unit_price || 0))}
                  </p>
                  <p className="text-sm font-semibold text-foreground font-body">
                    <span className="mr-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                      Total
                    </span>
                    {formatCurrency(calculateLineItemTotal(item))}
                  </p>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                      Service Item
                    </label>
                    <Input
                      value={item.service_item}
                      onChange={(event) => updateItem(index, "service_item", event.target.value)}
                      placeholder="Example: Tax return filing"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:contents">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, "quantity", event.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                        Price
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => updateItem(index, "unit_price", event.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:hidden">
                      Total
                    </label>
                    <div className="flex h-10 items-center rounded-xl border border-border bg-accent/10 px-3 text-sm font-semibold text-foreground">
                      {formatCurrency(calculateLineItemTotal(item))}
                    </div>
                  </div>
                  <div className="flex justify-end md:block">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 rounded-xl px-3 text-destructive hover:text-destructive md:w-10 md:px-0"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="ml-2 md:hidden">Remove item</span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
