import * as React from "react";
import { format, isValid, parseISO } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  buttonClassName?: string;
};

function DatePicker({ value, onChange, placeholder, className, buttonClassName }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = value ? parseISO(value) : undefined;
  const hasValidDate = selectedDate ? isValid(selectedDate) : false;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,hsl(220_12%_15%_/_0.98),hsl(220_12%_9%_/_0.98))] px-4 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_28px_-20px_rgba(0,0,0,0.95)] transition-all hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20",
            buttonClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <CalendarIcon className="h-4 w-4 shrink-0 text-white/55" />
            <span className={cn("truncate", !value && "text-muted-foreground/60")}>
              {hasValidDate ? format(selectedDate, "dd-MM-yyyy") : placeholder}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className={cn(
          "w-auto overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,hsl(220_12%_12%_/_0.99),hsl(220_12%_8%_/_0.99))] p-0 text-foreground shadow-[0_28px_60px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
          className,
        )}
      >
        <Calendar
          mode="single"
          selected={hasValidDate ? selectedDate : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };