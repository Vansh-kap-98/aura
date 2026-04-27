import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CalendarClock, AlertTriangle, X } from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Team, WorkspaceEvent } from "@/types/collab";

type NotificationsDockProps = {
  events: WorkspaceEvent[];
  teams: Team[];
};

type AlertItem = {
  id: string;
  title: string;
  subtitle: string;
  kind: "event" | "clash";
};

const getEventRange = (event: WorkspaceEvent) => {
  const [legacyFrom, legacyTo] = (event.time ?? "").split("-");
  const from = event.timeFrom ?? legacyFrom ?? undefined;
  const to = event.timeTo ?? legacyTo ?? undefined;
  return { from, to };
};

const getTimeValue = (value?: string) => value ?? "99:99";

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
};

const rangesOverlap = (
  left: { from?: string; to?: string },
  right: { from?: string; to?: string }
) => {
  if (!left.from || !right.from) return false;
  const leftStart = timeToMinutes(left.from);
  const rightStart = timeToMinutes(right.from);
  const leftEnd = left.to ? timeToMinutes(left.to) : leftStart;
  const rightEnd = right.to ? timeToMinutes(right.to) : rightStart;

  return leftStart < rightEnd && rightStart < leftEnd;
};

const rangeLabel = (event: WorkspaceEvent) => {
  const { from, to } = getEventRange(event);
  if (from && to) return `${from}→${to}`;
  if (from) return from;
  return null;
};

export const NotificationsDock = ({ events, teams }: NotificationsDockProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"personal" | "space">("personal");
  const [seenAlertIds, setSeenAlertIds] = useState<string[]>([]);

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return events
      .filter((event) => isAfter(parseISO(event.date), today) || event.date === format(today, "yyyy-MM-dd"))
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        const aRange = getEventRange(a);
        const bRange = getEventRange(b);
        return getTimeValue(aRange.from).localeCompare(getTimeValue(bRange.from));
      });
  }, [events]);

  const filtered = useMemo(
    () => upcoming.filter((event) => event.scope === tab),
    [upcoming, tab]
  );

  const clashAlerts = useMemo<AlertItem[]>(() => {
    const byDate = new Map<string, WorkspaceEvent[]>();

    filtered.forEach((event) => {
      const { from, to } = getEventRange(event);
      if (!from) return;
      const list = byDate.get(event.date) ?? [];
      list.push(event);
      byDate.set(event.date, list);
    });

    return Array.from(byDate.entries())
      .flatMap(([date, list]) => {
        const alertsForDate: AlertItem[] = [];

        list.forEach((event, index) => {
          const eventRange = getEventRange(event);
          const overlaps = list
            .slice(index + 1)
            .filter((candidate) => rangesOverlap(eventRange, getEventRange(candidate)));

          if (!overlaps.length) return;

          const names = [event.title, ...overlaps.map((item) => item.title)].slice(0, 3).join(", ");
          const otherRange = getEventRange(overlaps[0]);
          const timeText = eventRange.to || otherRange.to ? `${eventRange.from}→${eventRange.to ?? otherRange.to ?? eventRange.from}` : eventRange.from;

          alertsForDate.push({
            id: `clash:${date}:${event.id}`,
            title: "Time clash detected",
            subtitle: `${format(parseISO(date), "EEE, MMM d")} at ${timeText} · ${names}${overlaps.length > 2 ? "..." : ""}`,
            kind: "clash",
          });
        });

        return alertsForDate;
      });
  }, [filtered]);

  const eventAlerts = useMemo<AlertItem[]>(() => {
    return filtered.map((event) => {
      const team = event.teamId ? teams.find((item) => item.id === event.teamId) : null;
      return {
        id: event.id,
        title: event.title,
        subtitle: `${format(parseISO(event.date), "EEE, MMM d")}${rangeLabel(event) ? ` at ${rangeLabel(event)}` : ""}${team ? ` · ${team.name}` : ""}`,
        kind: "event",
      };
    });
  }, [filtered, teams]);

  const alerts = useMemo(() => [...clashAlerts, ...eventAlerts], [clashAlerts, eventAlerts]);

  const unseenCount = alerts.filter((alert) => !seenAlertIds.includes(alert.id)).length;

  const markSeen = (id: string) => {
    setSeenAlertIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="pointer-events-auto glass-strong shadow-float mb-3 w-[24rem] rounded-3xl p-4"
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
              {(["personal", "space"] as const).map((nextTab) => (
                <button
                  key={nextTab}
                  onClick={() => setTab(nextTab)}
                  className={cn(
                    "flex-1 rounded-xl px-3 py-2 transition-colors",
                    tab === nextTab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {nextTab === "personal" ? "Personal" : "Space"}
                </button>
              ))}
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {alerts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No upcoming {tab} alerts.
                </div>
              )}

              {alerts.map((alert) => {
                const unseen = !seenAlertIds.includes(alert.id);

                return (
                  <button
                    key={alert.id}
                    onClick={() => markSeen(alert.id)}
                    className={cn(
                      "w-full text-left rounded-2xl p-[1px] transition-all",
                      unseen
                        ? "bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500"
                        : "bg-transparent"
                    )}
                  >
                    <div className="glass rounded-[calc(theme(borderRadius.2xl)-1px)] px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        {alert.kind === "clash" ? (
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <CalendarClock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium leading-tight">{alert.title}</p>
                          <p className="text-muted-foreground mt-1 text-xs">{alert.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto bg-gradient-primary text-primary-foreground shadow-glow flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
      >
        <Bell className="h-4 w-4" />
        Notifications
        {unseenCount > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{unseenCount}</span>
        )}
      </button>
    </div>
  );
};
