import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Check,
  Calendar as CalIcon,
  Paperclip,
  Send,
  MessageCircle,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Team, WorkspaceEvent, WorkspaceEventType } from "@/types/collab";

type PulseCalendarProps = {
  events: WorkspaceEvent[];
  setEvents: Dispatch<SetStateAction<WorkspaceEvent[]>>;
  teams: Team[];
  activeTeam: Team | null;
  openTextChannels: Array<{ teamId: string; channelId: string }>;
  closeTextChannel: (teamId: string, channelId: string) => void;
  setTeams: Dispatch<SetStateAction<Team[]>>;
  userEmail: string;
};

type ChatWindowLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const EVENT_TYPES: {
  type: WorkspaceEventType;
  label: string;
  dot: string;
  text: string;
}[] = [
  {
    type: "meeting",
    label: "Meeting",
    dot: "bg-sky-400",
    text: "text-sky-700 dark:text-sky-300",
  },
  {
    type: "meetingReminder",
    label: "Meeting Reminder",
    dot: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    type: "deadline",
    label: "Deadline",
    dot: "bg-rose-400",
    text: "text-rose-700 dark:text-rose-300",
  },
  {
    type: "focus",
    label: "Focus",
    dot: "bg-violet-400",
    text: "text-violet-700 dark:text-violet-300",
  },
  {
    type: "social",
    label: "Social",
    dot: "bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
  },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const buildGrid = (monthStart: Date): Date[] => {
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
};

const toKey = (d: Date) => format(d, "yyyy-MM-dd");
const todayKey = () => toKey(new Date());

export const PulseCalendar = ({
  events,
  setEvents,
  teams,
  activeTeam,
  openTextChannels,
  closeTextChannel,
  setTeams,
  userEmail,
}: PulseCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickType, setQuickType] = useState<WorkspaceEventType>("meeting");
  const [quickScope, setQuickScope] = useState<"personal" | "space">("personal");

  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState(todayKey);
  const [modalTitle, setModalTitle] = useState("");
  const [modalType, setModalType] = useState<WorkspaceEventType>("meeting");
  const [modalScope, setModalScope] = useState<"personal" | "space">("personal");

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [windowLayouts, setWindowLayouts] = useState<Record<string, ChatWindowLayout>>({});
  const dragRef = useRef<{
    key: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const resizeRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
    edge: string;
  } | null>(null);

  const grid = buildGrid(currentMonth);
  const eventsFor = (dateKey: string) => events.filter((e) => e.date === dateKey);

  const createEvent = (
    date: string,
    title: string,
    type: WorkspaceEventType,
    scope: "personal" | "space"
  ) => {
    const useSpaceScope = scope === "space" && !!activeTeam;
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date,
        title,
        type,
        scope: useSpaceScope ? "space" : "personal",
        teamId: useSpaceScope ? activeTeam?.id : undefined,
      },
    ]);
  };

  const addQuickEvent = () => {
    if (!quickTitle.trim() || !selectedDate) return;
    createEvent(selectedDate, quickTitle.trim(), quickType, quickScope);
    setQuickTitle("");
  };

  const addModalEvent = () => {
    if (!modalTitle.trim() || !modalDate) return;
    createEvent(modalDate, modalTitle.trim(), modalType, modalScope);
    setModalTitle("");
    setModalDate(todayKey());
    setShowModal(false);
  };

  const deleteEvent = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const openModal = () => {
    setModalDate(selectedDate ?? todayKey());
    setModalTitle("");
    setModalType("meeting");
    setShowModal(true);
  };

  const openChats = useMemo(() => {
    return openTextChannels
      .map(({ teamId, channelId }) => {
        const team = teams.find((t) => t.id === teamId);
        if (!team) return null;
        const channel = team.channels.find(
          (c) => c.id === channelId && (c.type === "text" || c.type === "hidden")
        );
        if (!channel) return null;
        return { team, channel };
      })
      .filter((entry): entry is { team: Team; channel: Team["channels"][number] } => !!entry);
  }, [openTextChannels, teams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setWindowLayouts((prev) => {
      const next = { ...prev };
      openChats.forEach((entry, idx) => {
        const key = `${entry.team.id}-${entry.channel.id}`;
        if (!next[key]) {
          next[key] = {
            left: Math.max(16, window.innerWidth - 368 - idx * 24),
            top: Math.max(16, window.innerHeight - 320 - idx * 24),
            width: 360,
            height: 288,
          };
        }
      });
      return next;
    });
  }, [openChats]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragRef.current) {
        const { key, offsetX, offsetY } = dragRef.current;
        setWindowLayouts((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            left: Math.max(12, event.clientX - offsetX),
            top: Math.max(12, event.clientY - offsetY),
          },
        }));
      }
      if (resizeRef.current) {
        const { key, startX, startY, startLeft, startTop, startWidth, startHeight, edge } = resizeRef.current;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (edge.includes("left")) {
          newLeft = Math.max(12, startLeft + deltaX);
          newWidth = Math.max(200, startWidth - deltaX);
        }
        if (edge.includes("right")) {
          newWidth = Math.max(200, startWidth + deltaX);
        }
        if (edge.includes("top")) {
          newTop = Math.max(12, startTop + deltaY);
          newHeight = Math.max(160, startHeight - deltaY);
        }
        if (edge.includes("bottom")) {
          newHeight = Math.max(160, startHeight + deltaY);
        }

        setWindowLayouts((prev) => ({
          ...prev,
          [key]: {
            left: newLeft,
            top: newTop,
            width: newWidth,
            height: newHeight,
          },
        }));
      }
    };

    const stopDragging = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const startDragging = (
    key: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    const layout = windowLayouts[key] ?? {
      left: Math.max(16, window.innerWidth - 368),
      top: Math.max(16, window.innerHeight - 320),
      width: 360,
      height: 288,
    };
    dragRef.current = {
      key,
      offsetX: event.clientX - layout.left,
      offsetY: event.clientY - layout.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startResizing = (
    key: string,
    edge: string,
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();
    const layout = windowLayouts[key] ?? {
      left: Math.max(16, window.innerWidth - 368),
      top: Math.max(16, window.innerHeight - 320),
      width: 360,
      height: 288,
    };
    resizeRef.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: layout.left,
      startTop: layout.top,
      startWidth: layout.width,
      startHeight: layout.height,
      edge,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const postMessage = (teamId: string, channelId: string, text: string, files: File[]) => {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;

    setTeams((prev) =>
      prev.map((team) =>
        team.id !== teamId
          ? team
          : {
              ...team,
              channels: team.channels.map((channel) =>
                channel.id !== channelId
                  ? channel
                  : {
                      ...channel,
                      messages: [
                        ...channel.messages,
                        {
                          id: crypto.randomUUID(),
                          author: userEmail,
                          text: trimmed,
                          createdAt: new Date().toISOString(),
                          media: files.map((file) => ({
                            id: crypto.randomUUID(),
                            name: file.name,
                            type: file.type || "application/octet-stream",
                            size: file.size,
                          })),
                        },
                      ],
                    }
              ),
            }
      )
    );

    setDrafts((prev) => ({ ...prev, [channelId]: "" }));
  };

  return (
    <main className="relative flex h-full flex-1 flex-col gap-4 p-6 pl-0">
      <header className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{format(currentMonth, "MMMM yyyy")}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {selectedDate
              ? `Adding to ${format(parseISO(selectedDate), "MMMM d")}`
              : "Your calendar"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="glass press hover:bg-muted/60 grid h-9 w-9 place-items-center rounded-full transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setCurrentMonth(startOfMonth(new Date()));
              setSelectedDate(null);
            }}
            className="glass press hover:bg-muted/60 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="glass press hover:bg-muted/60 grid h-9 w-9 place-items-center rounded-full transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={openModal}
            className="bg-gradient-primary text-primary-foreground shadow-glow ml-2 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New
          </motion.button>
        </div>
      </header>

      <div className="glass shadow-soft flex flex-1 flex-col overflow-hidden rounded-3xl p-4">
        <div className="grid grid-cols-7 gap-1 pb-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-muted-foreground py-2 text-center text-xs font-medium uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-1">
          {grid.map((day, i) => {
            const dateKey = toKey(day);
            const dayEvents = eventsFor(dateKey);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isSelected = selectedDate === dateKey;
            const hasMeetingReminder = dayEvents.some((e) => e.type === "meetingReminder");

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.003 }}
                onClick={() => {
                  setSelectedDate(isSelected ? null : dateKey);
                  setQuickTitle("");
                }}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-0.5 rounded-2xl p-2 transition-all",
                  !inMonth && "opacity-25",
                  hasMeetingReminder && "ring-1 ring-amber-400/80",
                  isSelected ? "bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-medium",
                      today
                        ? "bg-primary text-primary-foreground shadow-glow font-semibold"
                        : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const et = EVENT_TYPES.find((t) => t.type === ev.type)!;
                    return (
                      <div
                        key={ev.id}
                        className="group/ev flex items-center gap-1 truncate rounded-md px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", et.dot)} />
                        <span className={cn("flex-1 truncate text-[11px] font-medium", et.text)}>
                          {ev.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEvent(ev.id);
                          }}
                          className="shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover/ev:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <span className="text-muted-foreground px-1 text-[10px] font-medium">
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <motion.div
            key="quickadd"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="glass shadow-soft flex items-center gap-3 rounded-2xl px-4 py-3"
          >
            <div className="flex shrink-0 items-center gap-1.5">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setQuickType(t.type)}
                  title={t.label}
                  className={cn(
                    "h-3 w-3 rounded-full transition-transform",
                    t.dot,
                    quickType === t.type
                      ? "scale-125 ring-2 ring-white/50 ring-offset-1"
                      : "opacity-40 hover:opacity-70"
                  )}
                />
              ))}
            </div>

            <input
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addQuickEvent();
                if (e.key === "Escape") setSelectedDate(null);
              }}
              placeholder={`Add to ${format(parseISO(selectedDate), "MMM d")}...`}
              className="placeholder:text-muted-foreground/60 flex-1 bg-transparent text-sm outline-none"
            />

            <select
              value={quickScope}
              onChange={(e) => setQuickScope(e.target.value as "personal" | "space")}
              className="rounded-xl bg-muted px-2 py-1 text-xs"
            >
              <option value="personal">Personal</option>
              <option value="space" disabled={!activeTeam}>Space</option>
            </select>

            <button
              onClick={addQuickEvent}
              disabled={!quickTitle.trim()}
              className="bg-primary text-primary-foreground grid h-7 w-7 shrink-0 place-items-center rounded-xl disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-muted-foreground flex items-center justify-center gap-6 text-xs">
        {EVENT_TYPES.map(({ type, label, dot }) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", dot)} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/5 p-4 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong shadow-float w-full max-w-sm rounded-3xl p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-semibold">New Event</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground rounded-xl p-1 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/40">
                  <CalIcon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/40">
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
                  <input
                    autoFocus
                    placeholder="Event title..."
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addModalEvent();
                    }}
                    className="placeholder:text-muted-foreground/60 w-full bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="glass rounded-2xl p-2">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">Scope</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setModalScope("personal")}
                      className={cn(
                        "rounded-xl px-3 py-2 text-xs",
                        modalScope === "personal" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      Personal
                    </button>
                    <button
                      onClick={() => setModalScope("space")}
                      disabled={!activeTeam}
                      className={cn(
                        "rounded-xl px-3 py-2 text-xs disabled:opacity-40",
                        modalScope === "space" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      Space
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {EVENT_TYPES.map(({ type, label, dot }) => (
                    <button
                      key={type}
                      onClick={() => setModalType(type)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-[11px] font-medium transition-all",
                        modalType === type ? "bg-muted shadow-soft scale-95" : "hover:bg-muted/60"
                      )}
                    >
                      <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowModal(false)}
                    className="glass hover:bg-muted/60 flex-1 rounded-2xl py-3 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={addModalEvent}
                    disabled={!modalTitle.trim()}
                    className="bg-gradient-primary text-primary-foreground shadow-glow flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    Add Event
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {openChats.map((entry, idx) => {
        const key = `${entry.team.id}-${entry.channel.id}`;
        const draft = drafts[entry.channel.id] ?? "";
        const layout = windowLayouts[key] ?? {
          left: Math.max(16, window.innerWidth - 368 - idx * 24),
          top: Math.max(16, window.innerHeight - 320 - idx * 24),
          width: 360,
          height: 288,
        };

        return (
          <div
            key={key}
            className="glass-strong shadow-float fixed z-40 flex flex-col overflow-hidden rounded-2xl"
            style={{ left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
          >
            {/* Resize handles */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(0deg, transparent calc(100% - 8px), rgba(136, 136, 136, 0.1) calc(100% - 8px)),
                  linear-gradient(90deg, transparent calc(100% - 8px), rgba(136, 136, 136, 0.1) calc(100% - 8px)),
                  linear-gradient(180deg, transparent 8px, rgba(136, 136, 136, 0.1) 8px),
                  linear-gradient(270deg, transparent 8px, rgba(136, 136, 136, 0.1) 8px)
                `,
              }}
            />
            {/* Top edge */}
            <div
              className="absolute top-0 left-0 right-0 h-1 cursor-n-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "top", e)}
            />
            {/* Bottom edge */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "bottom", e)}
            />
            {/* Left edge */}
            <div
              className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "left", e)}
            />
            {/* Right edge */}
            <div
              className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "right", e)}
            />
            {/* Top-left corner */}
            <div
              className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "top-left", e)}
            />
            {/* Top-right corner */}
            <div
              className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize pointer-events-auto"
              style={{ zIndex: 5 }}
              onPointerDown={(e) => startResizing(key, "top-right", e)}
            />
            {/* Bottom-left corner */}
            <div
              className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "bottom-left", e)}
            />
            {/* Bottom-right corner */}
            <div
              className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize pointer-events-auto"
              onPointerDown={(e) => startResizing(key, "bottom-right", e)}
            />

            <div
              className="border-border relative z-10 flex items-center justify-between border-b px-3 py-2 select-none touch-none cursor-move"
              onPointerDown={(event) => startDragging(key, event)}
            >
              <div>
                <p className="text-xs font-semibold">#{entry.channel.name}</p>
                <p className="text-muted-foreground text-[10px]">{entry.team.name}</p>
              </div>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTextChannel(entry.team.id, entry.channel.id);
                }}
                className="text-muted-foreground hover:text-foreground pointer-events-auto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {entry.channel.messages.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  <MessageCircle className="mx-auto mb-1 h-4 w-4" />
                  Start chatting in this channel.
                </div>
              )}

              {entry.channel.messages.map((msg) => {
                const isUserMessage = msg.author === userEmail;
                const isLeaderMessage = msg.author === entry.team.leaderEmail;
                const isImportant = msg.text?.includes("@Important");
                const shouldBeGold = isLeaderMessage && isImportant;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-xl px-2.5 py-2 text-xs",
                      isUserMessage ? "ml-auto max-w-xs bg-primary/20 text-right" : "mr-auto max-w-xs bg-muted/60",
                      shouldBeGold && "bg-amber-500/30 ring-1 ring-amber-400/50"
                    )}
                  >
                    <p
                      className={cn(
                        "mb-1 font-semibold leading-tight",
                        isUserMessage && "text-cyan-400",
                        shouldBeGold && "text-amber-300"
                      )}
                    >
                      {msg.author}
                    </p>
                    {msg.text && (
                      <p
                        className={cn(
                          isUserMessage ? "text-cyan-50" : "text-foreground/90",
                          shouldBeGold && "text-amber-100"
                        )}
                      >
                        {msg.text}
                      </p>
                    )}
                    {msg.media.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {msg.media.map((media) => (
                          <div key={media.id} className="rounded-lg bg-background/70 px-2 py-1">
                            <p className="truncate">{media.name}</p>
                            <p className="text-muted-foreground text-[10px]">
                              {(media.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-border space-y-2 border-t p-2.5">
              <input
                value={draft}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [entry.channel.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    postMessage(entry.team.id, entry.channel.id, draft, []);
                  }
                }}
                placeholder="Type message..."
                className="w-full rounded-xl bg-background/70 px-3 py-2 text-xs outline-none"
              />

              <div className="flex items-center justify-between">
                <label className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs">
                  <Paperclip className="h-3.5 w-3.5" />
                  Media
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length === 0) return;
                      postMessage(entry.team.id, entry.channel.id, draft, files);
                      e.target.value = "";
                    }}
                  />
                </label>

                <button
                  onClick={() => postMessage(entry.team.id, entry.channel.id, draft, [])}
                  className="bg-primary text-primary-foreground rounded-lg p-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
};
