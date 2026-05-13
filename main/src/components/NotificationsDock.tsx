import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CalendarClock, AlertTriangle, Trash2, X, Check, XCircle } from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Team, WorkspaceEvent } from "@/types/collab";

type NotificationsDockProps = {
  events: WorkspaceEvent[];
  teams: Team[];
  userEmail: string;
  onMentionNavigate?: (target: { teamId: string; channelId: string; messageId: string }) => void;
  feedbackPending?: Array<{
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventTimeFrom?: string;
    eventTimeTo?: string;
  }>;
  onMeetingFeedback?: (eventId: string, attended: boolean) => void;
};

type AlertItem = {
  id: string;
  title: string;
  subtitle: string;
  kind: "event" | "clash" | "mention" | "feedback";
  groupKey: string;
  groupLabel: string;
  when?: string;
  target?: {
    teamId: string;
    channelId: string;
    messageId: string;
  };
  feedbackEventId?: string;
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

const getTeamLabel = (event: WorkspaceEvent, teams: Team[]) => {
  if (!event.teamId) return "Personal";
  return teams.find((team) => team.id === event.teamId)?.name ?? "Space";
};

const getMentionHandle = (value: string) =>
  value
    .trim()
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const NotificationsDock = ({
  events,
  teams,
  userEmail,
  onMentionNavigate,
  feedbackPending = [],
  onMeetingFeedback,
}: NotificationsDockProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"personal" | "space">("personal");
  const [seenAlertIds, setSeenAlertIds] = useState<string[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [removingAlertIds, setRemovingAlertIds] = useState<string[]>([]);
  const [pendingDeleteAlertId, setPendingDeleteAlertId] = useState<string | null>(null);

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

  const personalScheduleEvents = useMemo(
    () => upcoming.filter((event) => event.scope === "personal"),
    [upcoming]
  );

  const taggedEvents = useMemo(
    () => upcoming.filter((event) => event.taggedEmail === userEmail),
    [upcoming, userEmail]
  );

  const spaceEvents = useMemo(
    () => upcoming.filter((event) => event.scope === "space"),
    [upcoming]
  );

  const spaceMessageMentions = useMemo<AlertItem[]>(() => {
    const selfHandle = getMentionHandle(userEmail);
    if (!selfHandle) return [];

    const mentionRegex = new RegExp(`@${escapeRegExp(selfHandle)}\\b`, "i");

    return teams.flatMap((team) =>
      team.channels.flatMap((channel) =>
        channel.messages
          .filter((message) => mentionRegex.test(message.text ?? ""))
          .map((message) => ({
            id: `space-mention:${team.id}:${channel.id}:${message.id}`,
            title: `@ Mention in #${channel.name}`,
            subtitle: `${message.authorName || message.authorEmail} mentioned @${selfHandle}`,
            when: format(parseISO(message.createdAt), "EEE, MMM d • p"),
            kind: "mention" as const,
            groupKey: team.id,
            groupLabel: team.name,
            target: {
              teamId: team.id,
              channelId: channel.id,
              messageId: message.id,
            },
          }))
      )
    );
  }, [teams, userEmail]);

  const clashAlerts = useMemo<AlertItem[]>(() => {
    const byDate = new Map<string, WorkspaceEvent[]>();

    upcoming.forEach((event) => {
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
            when: `${format(parseISO(date), "EEE, MMM d")} • ${timeText}`,
            kind: "clash",
            groupKey: "conflicts",
            groupLabel: "Conflicts",
          });
        });

        return alertsForDate;
      });
  }, [upcoming]);

  const personalAlerts = useMemo<AlertItem[]>(() => {
    const scheduleAlerts = personalScheduleEvents.map((event) => ({
      id: `personal:${event.id}`,
      title: event.title,
      subtitle: `${format(parseISO(event.date), "EEE, MMM d")}${rangeLabel(event) ? ` at ${rangeLabel(event)}` : ""}`,
      when: `${format(parseISO(event.date), "EEE, MMM d")} ${rangeLabel(event) ? `• ${rangeLabel(event)}` : ""}`,
      kind: "event" as const,
      groupKey: "personal",
      groupLabel: "Personal",
    }));

    const mentionAlerts = taggedEvents
      .filter((event) => event.scope === "space")
      .map((event) => ({
        id: `mention:${event.id}`,
        title: `@ Mention in ${getTeamLabel(event, teams)}`,
        subtitle: `${format(parseISO(event.date), "EEE, MMM d")}${rangeLabel(event) ? ` at ${rangeLabel(event)}` : ""} · ${event.title}`,
        when: `${format(parseISO(event.date), "EEE, MMM d")} ${rangeLabel(event) ? `• ${rangeLabel(event)}` : ""}`,
        kind: "mention" as const,
        groupKey: "mentions",
        groupLabel: "Mentions",
      }));

    const feedbackAlerts = feedbackPending.map((feedback) => ({
      id: `feedback:${feedback.eventId}`,
      title: "How did it go?",
      subtitle: `${feedback.eventTitle}${feedback.eventTimeFrom ? ` · ${feedback.eventTimeFrom}` : ""}`,
      when: format(parseISO(feedback.eventDate), "EEE, MMM d"),
      kind: "feedback" as const,
      groupKey: "feedback",
      groupLabel: "Meeting Feedback",
      feedbackEventId: feedback.eventId,
    }));

    return [...clashAlerts, ...scheduleAlerts, ...mentionAlerts, ...feedbackAlerts];
  }, [clashAlerts, personalScheduleEvents, taggedEvents, teams, feedbackPending]);

  const spaceAlerts = useMemo<AlertItem[]>(() => {
    const eventAlerts: AlertItem[] = spaceEvents.map((event) => ({
      id: `space:${event.id}`,
      title: event.title,
      subtitle: `${format(parseISO(event.date), "EEE, MMM d")}${rangeLabel(event) ? ` at ${rangeLabel(event)}` : ""}`,
      when: `${format(parseISO(event.date), "EEE, MMM d")} ${rangeLabel(event) ? `• ${rangeLabel(event)}` : ""}`,
      kind: event.taggedEmail === userEmail ? "mention" : "event",
      groupKey: event.teamId ?? "unassigned",
      groupLabel: getTeamLabel(event, teams),
    }));

    return [...spaceMessageMentions, ...eventAlerts];
  }, [spaceEvents, spaceMessageMentions, teams, userEmail]);

  const alerts = useMemo(
    () =>
      (tab === "personal" ? personalAlerts : spaceAlerts).filter(
        (alert) => !dismissedAlertIds.includes(alert.id)
      ),
    [tab, personalAlerts, spaceAlerts, dismissedAlertIds]
  );

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => !removingAlertIds.includes(alert.id)),
    [alerts, removingAlertIds]
  );

  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, { label: string; items: AlertItem[] }>();
    alerts.forEach((alert) => {
      const current = groups.get(alert.groupKey) ?? { label: alert.groupLabel, items: [] };
      current.items.push(alert);
      groups.set(alert.groupKey, current);
    });
    return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
  }, [alerts]);

  const unseenCount = alerts.filter((alert) => !seenAlertIds.includes(alert.id)).length;

  const markSeen = (id: string) => {
    setSeenAlertIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const deleteAlert = (alert: AlertItem) => {
    const isUnread = !seenAlertIds.includes(alert.id);
    if (isUnread) {
      setPendingDeleteAlertId(alert.id);
      return;
    }

    setRemovingAlertIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]));
    window.setTimeout(() => {
      setDismissedAlertIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]));
      setRemovingAlertIds((prev) => prev.filter((id) => id !== alert.id));
    }, 180);
  };

  const confirmDeleteAlert = (alert: AlertItem) => {
    setPendingDeleteAlertId(null);
    setRemovingAlertIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]));
    window.setTimeout(() => {
      setDismissedAlertIds((prev) => (prev.includes(alert.id) ? prev : [...prev, alert.id]));
      setRemovingAlertIds((prev) => prev.filter((id) => id !== alert.id));
    }, 180);
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

            <div className="max-h-72 space-y-3 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
              {visibleAlerts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No upcoming {tab} alerts.
                </div>
              )}

              {groupedAlerts
                .map((group) => ({
                  ...group,
                  items: group.items.filter((alert) => !removingAlertIds.includes(alert.id)),
                }))
                .filter((group) => group.items.length > 0)
                .map((group) => (
                <div key={group.key} className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.items.map((alert) => {
                      const unseen = !seenAlertIds.includes(alert.id);
                      const spaceMentionHighlight = tab === "space" && alert.kind === "mention";

                      return (
                        <motion.div
                          key={alert.id}
                          layout
                          initial={{ opacity: 0, y: 0, scale: 1 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            scale: 0.01,
                            rotate: 20,
                            borderRadius: "50%",
                            transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                          }}
                          style={{ transformOrigin: "center center" }}
                          className={cn(
                            "relative w-full rounded-2xl p-[1px] transition-all",
                            unseen && spaceMentionHighlight
                              ? "bg-gradient-to-r from-red-500 via-pink-500 to-orange-400"
                              : unseen
                              ? "bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500"
                              : "bg-transparent"
                          )}
                        >
                          <div className="glass rounded-[calc(theme(borderRadius.2xl)-1px)] px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                markSeen(alert.id);
                                if (alert.target) {
                                  onMentionNavigate?.(alert.target);
                                }
                              }}
                              className="w-full text-left"
                            >
                              <div className="flex items-start gap-2 pr-9">
                                {alert.kind === "clash" ? (
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-rose-400" />
                                ) : alert.kind === "mention" ? (
                                  <span className="mt-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">@</span>
                                ) : alert.kind === "feedback" ? (
                                  <span className="mt-0.5 rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-400">✓</span>
                                ) : (
                                  <CalendarClock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-medium leading-tight">{alert.title}</p>
                                    {alert.when && (
                                      <span className="ml-2 text-xs text-muted-foreground">{alert.when}</span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">{alert.subtitle}</p>
                                </div>
                              </div>
                            </button>

                            {alert.kind === "feedback" && alert.feedbackEventId && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onMeetingFeedback?.(alert.feedbackEventId!, true);
                                    setDismissedAlertIds((prev) =>
                                      prev.includes(alert.id) ? prev : [...prev, alert.id]
                                    );
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Completed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onMeetingFeedback?.(alert.feedbackEventId!, false);
                                    setDismissedAlertIds((prev) =>
                                      prev.includes(alert.id) ? prev : [...prev, alert.id]
                                    );
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/30 transition-colors"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Missed
                                </button>
                              </div>
                            )}

                            <AnimatePresence>
                              {pendingDeleteAlertId === alert.id && alert.kind !== "feedback" && (
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  className="mt-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2"
                                >
                                  <p className="text-xs text-muted-foreground">
                                    This alert is unread. Delete it from this card?
                                  </p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => confirmDeleteAlert(alert)}
                                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPendingDeleteAlertId(null)}
                                      className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {alert.kind !== "feedback" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteAlert(alert);
                              }}
                              className="absolute bottom-2 right-2 rounded-lg border border-border/60 bg-background/70 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                              aria-label="Delete alert"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
