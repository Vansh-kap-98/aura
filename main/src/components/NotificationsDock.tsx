import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CalendarClock, X } from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Team, WorkspaceEvent } from "@/types/collab";

type NotificationsDockProps = {
  events: WorkspaceEvent[];
  teams: Team[];
};

export const NotificationsDock = ({ events, teams }: NotificationsDockProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"personal" | "space">("personal");

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return events
      .filter((e) => isAfter(parseISO(e.date), today) || e.date === format(today, "yyyy-MM-dd"))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  const filtered = upcoming.filter((e) => e.scope === tab);

  const count = filtered.length;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="pointer-events-auto glass-strong shadow-float mb-3 w-[22rem] rounded-3xl p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="glass mb-3 flex rounded-2xl p-1 text-xs font-medium">
              {(["personal", "space"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 rounded-xl px-3 py-2 transition-colors",
                    tab === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {t === "personal" ? "Personal" : "Space"}
                </button>
              ))}
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No upcoming {tab} events.
                </div>
              )}

              {filtered.map((e) => {
                const team = e.teamId ? teams.find((t) => t.id === e.teamId) : null;
                return (
                  <div key={e.id} className="glass rounded-2xl px-3 py-2.5">
                    <p className="text-sm font-medium leading-tight">{e.title}</p>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>{format(parseISO(e.date), "EEE, MMM d")}</span>
                      {team && <span className="rounded-full bg-muted px-2 py-0.5">{team.name}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto bg-gradient-primary text-primary-foreground shadow-glow flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
      >
        <Bell className="h-4 w-4" />
        Notifications
        {count > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{count}</span>
        )}
      </button>
    </div>
  );
};
