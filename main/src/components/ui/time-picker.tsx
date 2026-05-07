import * as React from "react";
import { Clock3, ChevronDown } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  buttonClassName?: string;
  minuteStep?: number;
};

const buildRange = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

function TimePicker({
  value,
  onChange,
  placeholder,
  className,
  buttonClassName,
  minuteStep = 1,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const hours = React.useMemo(() => buildRange(0, 23), []);
  const minutes = React.useMemo(() => {
    const values: number[] = [];
    for (let minute = 0; minute < 60; minute += minuteStep) values.push(minute);
    return values;
  }, [minuteStep]);

  const [selectedHour = "", selectedMinute = ""] = value.split(":");
  const displayValue = value || placeholder;

  const setTime = (hour: number | string, minute: number | string) => {
    const next = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    onChange(next);
  };

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
            <Clock3 className="h-4 w-4 shrink-0 text-white/55" />
            <span className={cn("truncate", !value && "text-muted-foreground/60")}>
              {displayValue}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={10}
        className={cn(
          "w-auto overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,hsl(220_12%_12%_/_0.99),hsl(220_12%_8%_/_0.99))] p-3 text-foreground shadow-[0_28px_60px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl",
          className,
        )}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Time</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            Done
          </button>
        </div>

        <div className="flex gap-2">
          <div className="w-20 rounded-2xl border border-white/10 bg-white/5 p-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Hour</p>
            <ScrollArea className="h-56">
              <div className="space-y-1 pr-1">
                {hours.map((hour) => {
                  const hourLabel = String(hour).padStart(2, "0");
                  const active = hourLabel === selectedHour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => setTime(hourLabel, selectedMinute || "00")}
                      className={cn(
                        "flex w-full items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                          : "text-foreground/80 hover:bg-white/10",
                      )}
                    >
                      {hourLabel}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="w-20 rounded-2xl border border-white/10 bg-white/5 p-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Min</p>
            <ScrollArea className="h-56">
              <div className="space-y-1 pr-1">
                {minutes.map((minute) => {
                  const minuteLabel = String(minute).padStart(2, "0");
                  const active = minuteLabel === selectedMinute;
                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => setTime(selectedHour || "00", minuteLabel)}
                      className={cn(
                        "flex w-full items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                          : "text-foreground/80 hover:bg-white/10",
                      )}
                    >
                      {minuteLabel}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { TimePicker };