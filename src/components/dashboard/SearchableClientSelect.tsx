import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableClientOption = {
  id: string;
  label: string;
  clientCode?: string | null;
  searchText?: string | null;
};

type SearchableClientSelectProps = {
  value?: string | null;
  onValueChange: (value: string) => void;
  options: SearchableClientOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchableClientSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select a client",
  searchPlaceholder = "Search client by name, code, email or phone...",
  emptyText = "No client found.",
  disabled = false,
  className,
}: SearchableClientSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const getDisplayLabel = (option: SearchableClientOption) =>
    option.clientCode ? `${option.label} (${option.clientCode})` : option.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-xl bg-background px-3 font-normal",
            !selectedOption && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selectedOption ? getDisplayLabel(selectedOption) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const displayLabel = getDisplayLabel(option);
                const searchableValue = [
                  option.label,
                  option.clientCode,
                  option.searchText,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <CommandItem
                    key={option.id}
                    value={searchableValue}
                    onSelect={() => {
                      onValueChange(option.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{displayLabel}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
