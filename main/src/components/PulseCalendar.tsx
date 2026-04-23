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
  MessageCircle,
  Mic,
  ArrowRight,
  Sliders,
  Users,
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
import { filesToMedia, htmlToPlainText, sanitizeRichTextHtml } from "@/lib/message-utils";
import { Team, WorkspaceEvent, WorkspaceEventType } from "@/types/collab";

type PulseCalendarProps = {
  events: WorkspaceEvent[];
  setEvents: Dispatch<SetStateAction<WorkspaceEvent[]>>;
  teams: Team[];
  activeTeam: Team | null;
  selectedCalendarTeamIds: string[];
  setSelectedCalendarTeamIds: Dispatch<SetStateAction<string[]>>;
  openTextChannels: Array<{ teamId: string; channelId: string }>;
  closeTextChannel: (teamId: string, channelId: string) => void;
  setTeams: Dispatch<SetStateAction<Team[]>>;
  userEmail: string;
  userDisplayName: string;
};

type ChatWindowLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type EditingMessageState = {
  teamId: string;
  channelId: string;
  messageId: string;
  html: string;
};

type PendingDeleteState = {
  teamId: string;
  channelId: string;
  messageId: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  selectedCalendarTeamIds,
  setSelectedCalendarTeamIds,
  openTextChannels,
  closeTextChannel,
  setTeams,
  userEmail,
  userDisplayName,
}: PulseCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickType, setQuickType] = useState<WorkspaceEventType>("meeting");
  const [quickTeamId, setQuickTeamId] = useState<string>("personal");

  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState(todayKey);
  const [modalTitle, setModalTitle] = useState("");
  const [modalType, setModalType] = useState<WorkspaceEventType>("meeting");
  const [modalTeamId, setModalTeamId] = useState<string>("personal");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [deadlinePreviewDate, setDeadlinePreviewDate] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingMessage, setEditingMessage] = useState<EditingMessageState | null>(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<PendingDeleteState | null>(null);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<string | null>(null);
  const [windowLayouts, setWindowLayouts] = useState<Record<string, ChatWindowLayout>>({});
  const dragRef = useRef<{
    key: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const composerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
  const selectedTeamsSet = useMemo(() => new Set(selectedCalendarTeamIds), [selectedCalendarTeamIds]);

  const teamMembers = useMemo(() => {
    const emails = new Set<string>([userEmail]);

    teams
      .filter((team) => selectedTeamsSet.has(team.id))
      .forEach((team) => {
        emails.add(team.leaderEmail);
        team.channels.forEach((channel) => {
          channel.messages.forEach((message) => {
            if (message.authorEmail) emails.add(message.authorEmail);
          });
          (channel.settings.hidden?.allowedEmails ?? []).forEach((email) => emails.add(email));
        });
      });

    return Array.from(emails).sort((a, b) => a.localeCompare(b));
  }, [teams, selectedTeamsSet, userEmail]);

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const isPersonal = !event.teamId || event.scope === "personal";
      const isSelectedSpaceEvent = !!event.teamId && selectedTeamsSet.has(event.teamId);
      if (!isPersonal && !isSelectedSpaceEvent) return false;

      if (memberFilter === "all") return true;
      return (event.assigneeEmail ?? userEmail) === memberFilter;
    });
  }, [events, memberFilter, selectedTeamsSet, userEmail]);

  const eventsFor = (dateKey: string) => visibleEvents.filter((e) => e.date === dateKey);

  const createEvent = (
    date: string,
    title: string,
    type: WorkspaceEventType,
    teamId?: string
  ) => {
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date,
        title,
        type,
        scope: teamId ? "space" : "personal",
        teamId,
        assigneeEmail: userEmail,
      },
    ]);
  };

  const addQuickEvent = () => {
    if (!quickTitle.trim() || !selectedDate) return;
    createEvent(
      selectedDate,
      quickTitle.trim(),
      quickType,
      quickTeamId === "personal" ? undefined : quickTeamId
    );
    setQuickTitle("");
  };

  const addModalEvent = () => {
    if (!modalTitle.trim() || !modalDate) return;
    createEvent(
      modalDate,
      modalTitle.trim(),
      modalType,
      modalTeamId === "personal" ? undefined : modalTeamId
    );
    setModalTitle("");
    setModalDate(todayKey());
    setShowModal(false);
  };

  const deleteEvent = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const openModal = () => {
    setModalDate(selectedDate ?? todayKey());
    setModalTitle("");
    setModalType("meeting");
    setModalTeamId(activeTeam?.id ?? "personal");
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
    openChats.forEach((entry) => {
      const key = entry.channel.id;
      const editor = composerRefs.current[key];
      const html = drafts[key] ?? "";
      if (editor && editor.innerHTML !== html) {
        editor.innerHTML = html;
      }
    });
  }, [drafts, openChats]);

  useEffect(() => {
    if (!editingMessage) return;
    const editor = editRefs.current[editingMessage.messageId];
    if (editor && editor.innerHTML !== editingMessage.html) {
      editor.innerHTML = editingMessage.html;
    }
  }, [editingMessage]);

  const updateComposerHtml = (channelId: string, html: string) => {
    setDrafts((prev) => ({ ...prev, [channelId]: sanitizeRichTextHtml(html) }));
  };

  const runComposerCommand = (channelId: string, command: string, value?: string) => {
    const editor = composerRefs.current[channelId];
    if (!editor) return;
    
    editor.focus();
    
    // Apply the command without moving cursor
    document.execCommand(command, false, value);
    updateComposerHtml(channelId, editor.innerHTML);
  };

  const runEditCommand = (messageId: string, command: string, value?: string) => {
    const editor = editRefs.current[messageId];
    if (!editor) return;
    
    editor.focus();
    
    // Apply the command without moving cursor
    document.execCommand(command, false, value);
    setEditingMessage((prev) =>
      prev && prev.messageId === messageId
        ? { ...prev, html: sanitizeRichTextHtml(editor.innerHTML) }
        : prev
    );
  };

  const startEditMessage = (teamId: string, channelId: string, messageId: string, html: string) => {
    setEditingMessage({ teamId, channelId, messageId, html });
  };

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

  const handlePostMessage = async (
    teamId: string,
    channelId: string,
    html: string,
    files: File[]
  ) => {
    const safeHtml = sanitizeRichTextHtml(html);
    const plainText = htmlToPlainText(safeHtml);
    const media = files.length > 0 ? await filesToMedia(files) : [];
    if (!plainText && media.length === 0) return;

    const createdAt = new Date().toISOString();
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
                          author: userDisplayName,
                          authorEmail: userEmail,
                          authorName: userDisplayName,
                          text: plainText,
                          html: safeHtml || undefined,
                          createdAt,
                          media,
                        },
                      ],
                    }
              ),
            }
      )
    );

    setDrafts((prev) => ({ ...prev, [channelId]: "" }));
    const composer = composerRefs.current[channelId];
    if (composer) composer.innerHTML = "";
  };

  const updateMessage = (
    teamId: string,
    channelId: string,
    messageId: string,
    html: string
  ) => {
    const safeHtml = sanitizeRichTextHtml(html);
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
                      messages: channel.messages.map((message) =>
                        message.id !== messageId
                          ? message
                          : {
                              ...message,
                              text: htmlToPlainText(safeHtml),
                              html: safeHtml || undefined,
                              updatedAt: new Date().toISOString(),
                            }
                      ),
                    }
              ),
            }
      )
    );
    setEditingMessage(null);
  };

  const deleteMessage = (teamId: string, channelId: string, messageId: string) => {
    setPendingDeleteMessage({ teamId, channelId, messageId });
  };

  const confirmDeleteMessage = () => {
    if (!pendingDeleteMessage) return;
    const { teamId, channelId, messageId } = pendingDeleteMessage;

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
                      messages: channel.messages.filter((message) => message.id !== messageId),
                    }
              ),
            }
      )
    );

    setEditingMessage((prev) => (prev?.messageId === messageId ? null : prev));
    setPendingDeleteMessage(null);
  };

  const cancelDeleteMessage = () => {
    setPendingDeleteMessage(null);
  };

  const renderMessageBody = (messageHtml?: string, messageText?: string) => {
    const safeHtml = messageHtml ? sanitizeRichTextHtml(messageHtml) : escapeHtml(messageText ?? "").replace(/\n/g, "<br />");
    return <span dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  };

  const renderMediaPreview = (media: NonNullable<(typeof openChats)[number]>["channel"]["messages"][number]["media"][number]) => {
    if (media.kind === "image") {
      return (
        <img
          src={media.url}
          alt={media.name}
          className="max-h-40 w-full rounded-lg object-cover"
        />
      );
    }

    if (media.kind === "video") {
      return <video controls src={media.url} className="max-h-40 w-full rounded-lg" />;
    }

    if (media.kind === "audio") {
      return <audio controls src={media.url} className="w-full" />;
    }

    return (
      <a
        href={media.url}
        download={media.name}
        className="block rounded-lg bg-background/70 px-2 py-1 text-left"
      >
        <p className="truncate">{media.name}</p>
        <p className="text-muted-foreground text-[10px]">
          {(media.size / 1024).toFixed(1)} KB
        </p>
      </a>
    );
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

      <div className="glass shadow-soft flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-xs">
        <span className="text-muted-foreground font-semibold uppercase tracking-wider">Spaces</span>
        {teams.map((team) => {
          const selected = selectedTeamsSet.has(team.id);
          return (
            <button
              key={team.id}
              onClick={() =>
                setSelectedCalendarTeamIds((prev) =>
                  prev.includes(team.id) ? prev.filter((id) => id !== team.id) : [...prev, team.id]
                )
              }
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition-colors",
                selected ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
              )}
            >
              {team.name}
            </button>
          );
        })}

        <span className="text-muted-foreground ml-auto flex items-center gap-1 font-semibold uppercase tracking-wider">
          <Users className="h-3.5 w-3.5" /> Member
        </span>
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-xl bg-muted px-2 py-1 text-xs outline-none"
        >
          <option value="all">All members</option>
          {teamMembers.map((member) => (
            <option key={member} value={member}>
              {member}
            </option>
          ))}
        </select>
      </div>

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
                onDoubleClick={() => setDeadlinePreviewDate(dateKey)}
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
              value={quickTeamId}
              onChange={(e) => setQuickTeamId(e.target.value)}
              className="rounded-xl bg-muted px-2 py-1 text-xs"
            >
              <option value="personal">Personal</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
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
        {deadlinePreviewDate && (
          <motion.div
            key="deadline-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 p-4 backdrop-blur-sm"
            onClick={() => setDeadlinePreviewDate(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong shadow-float w-full max-w-sm rounded-3xl p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Deadlines · {format(parseISO(deadlinePreviewDate), "MMM d")}
                </h3>
                <button
                  onClick={() => setDeadlinePreviewDate(null)}
                  className="text-muted-foreground hover:text-foreground rounded-lg p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {eventsFor(deadlinePreviewDate)
                  .filter((event) => event.type === "deadline")
                  .map((event) => (
                    <div key={event.id} className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {(event.teamId && teams.find((team) => team.id === event.teamId)?.name) || "Personal"}
                      </p>
                    </div>
                  ))}
                {eventsFor(deadlinePreviewDate).filter((event) => event.type === "deadline").length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    No deadlines on this date.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

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
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">Space</p>
                  <select
                    value={modalTeamId}
                    onChange={(e) => setModalTeamId(e.target.value)}
                    className="w-full rounded-xl bg-muted px-3 py-2 text-xs outline-none"
                  >
                    <option value="personal">Personal</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
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
              className="absolute top-0 left-0 right-0 h-1.5 cursor-n-resize pointer-events-auto hover:bg-primary/30"
              onPointerDown={(e) => startResizing(key, "top", e)}
            />
            {/* Bottom edge */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize pointer-events-auto hover:bg-primary/30"
              onPointerDown={(e) => startResizing(key, "bottom", e)}
            />
            {/* Left edge */}
            <div
              className="absolute top-0 bottom-0 left-0 w-1.5 cursor-w-resize pointer-events-auto hover:bg-primary/30"
              onPointerDown={(e) => startResizing(key, "left", e)}
            />
            {/* Right edge */}
            <div
              className="absolute top-0 bottom-0 right-0 w-1.5 cursor-e-resize pointer-events-auto hover:bg-primary/30"
              onPointerDown={(e) => startResizing(key, "right", e)}
            />
            {/* Top-left corner */}
            <div
              className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize pointer-events-auto hover:bg-primary/40 transition-colors"
              onPointerDown={(e) => startResizing(key, "top-left", e)}
            />
            {/* Top-right corner */}
            <div
              className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize pointer-events-auto hover:bg-primary/40 transition-colors"
              style={{ zIndex: 5 }}
              onPointerDown={(e) => startResizing(key, "top-right", e)}
            />
            {/* Bottom-left corner */}
            <div
              className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize pointer-events-auto hover:bg-primary/40 transition-colors"
              onPointerDown={(e) => startResizing(key, "bottom-left", e)}
            />
            {/* Bottom-right corner */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize pointer-events-auto hover:bg-primary/40 transition-colors"
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
                const isUserMessage =
                  msg.authorEmail === userEmail || msg.author === userEmail;
                const isLeaderMessage = msg.author === entry.team.leaderEmail;
                const isImportant = (msg.text ?? msg.html ?? "").includes("@Important");
                const shouldBeGold = isLeaderMessage && isImportant;
                const isEditing = editingMessage?.messageId === msg.id;
                const displayName = msg.authorName || msg.author || msg.authorEmail;

                return (
                  <div key={msg.id} className={cn("group flex", isUserMessage ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "w-full max-w-xs rounded-xl px-2.5 py-2 text-xs",
                        isUserMessage ? "bg-primary/20 text-right" : "bg-muted/60",
                        shouldBeGold && "bg-amber-500/30 ring-1 ring-amber-400/50"
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                runEditCommand(msg.id, "bold");
                              }}
                              className="rounded-md bg-background/70 px-2 py-1 text-[10px] font-semibold"
                            >
                              B
                            </button>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                runEditCommand(msg.id, "italic");
                              }}
                              className="rounded-md bg-background/70 px-2 py-1 text-[10px] font-semibold italic"
                            >
                              I
                            </button>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                runEditCommand(msg.id, "underline");
                              }}
                              className="rounded-md bg-background/70 px-2 py-1 text-[10px] font-semibold underline"
                            >
                              U
                            </button>
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                runEditCommand(msg.id, "removeFormat");
                              }}
                              className="rounded-md bg-background/70 px-2 py-1 text-[10px]"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="relative rounded-lg bg-background/70 px-2 py-2 text-left">
                            <div
                              ref={(node) => {
                                editRefs.current[msg.id] = node;
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(event) =>
                                setEditingMessage((prev) =>
                                  prev && prev.messageId === msg.id
                                    ? {
                                        ...prev,
                                        html: sanitizeRichTextHtml(
                                          event.currentTarget.innerHTML
                                        ),
                                      }
                                    : prev
                                )
                              }
                              onKeyDown={(event) => {
                                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                  event.preventDefault();
                                  if (editingMessage?.html) {
                                    updateMessage(entry.team.id, entry.channel.id, msg.id, editingMessage.html);
                                  }
                                }
                              }}
                              className="min-h-20 whitespace-pre-wrap break-words outline-none"
                            />
                            {!editingMessage?.html && (
                              <span className="pointer-events-none absolute left-2 top-2 text-muted-foreground/60">
                                Edit your message...
                              </span>
                            )}
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingMessage(null)}
                              className="rounded-lg bg-background/70 px-2 py-1 text-[10px]"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => updateMessage(entry.team.id, entry.channel.id, msg.id, editingMessage?.html ?? msg.html ?? msg.text)}
                              className="rounded-lg bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p
                              className={cn(
                                "font-semibold leading-tight",
                                isUserMessage && "text-cyan-400",
                                shouldBeGold && "text-amber-300"
                              )}
                            >
                              {displayName}
                            </p>
                            <p className="text-muted-foreground text-[10px]">
                              {msg.updatedAt ? "edited" : format(new Date(msg.createdAt), "p")}
                            </p>
                          </div>

                          {msg.html ? (
                            <div
                              className={cn(
                                isUserMessage ? "text-cyan-50" : "text-foreground/90",
                                shouldBeGold && "text-amber-100"
                              )}
                              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(msg.html) }}
                            />
                          ) : (
                            <p
                              className={cn(
                                "whitespace-pre-wrap break-words",
                                isUserMessage ? "text-cyan-50" : "text-foreground/90",
                                shouldBeGold && "text-amber-100"
                              )}
                            >
                              {msg.text}
                            </p>
                          )}

                          {msg.media.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.media.map((media) => (
                                <div key={media.id}>{renderMediaPreview(media)}</div>
                              ))}
                            </div>
                          )}

                          {isUserMessage && (
                            <div className="mt-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() =>
                                  startEditMessage(
                                    entry.team.id,
                                    entry.channel.id,
                                    msg.id,
                                    sanitizeRichTextHtml(msg.html ?? escapeHtml(msg.text).replace(/\n/g, "<br />"))
                                  )
                                }
                                className="rounded-md bg-background/70 px-2 py-1 text-[10px]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteMessage(entry.team.id, entry.channel.id, msg.id)}
                                className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] text-destructive"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {pendingDeleteMessage && pendingDeleteMessage.channelId === entry.channel.id && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-foreground/10 backdrop-blur-sm"
              >
                <div className="glass-strong shadow-float rounded-2xl p-4 text-center">
                  <p className="mb-3 text-sm font-medium">Delete this message?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelDeleteMessage}
                      className="glass hover:bg-muted/60 flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteMessage}
                      className="bg-destructive text-destructive-foreground flex-1 rounded-lg px-3 py-2 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="border-border space-y-3 border-t p-3">
              {/* Notion-style floating formatting toolbar */}
              <AnimatePresence>
                {showFormattingToolbar === entry.channel.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="glass-strong shadow-float flex flex-wrap items-center gap-2 rounded-2xl p-2"
                  >
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runComposerCommand(entry.channel.id, "bold");
                      }}
                      className="rounded-lg bg-background/70 px-2 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runComposerCommand(entry.channel.id, "italic");
                      }}
                      className="rounded-lg bg-background/70 px-2 py-1.5 text-xs italic hover:bg-muted transition-colors"
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runComposerCommand(entry.channel.id, "underline");
                      }}
                      className="rounded-lg bg-background/70 px-2 py-1.5 text-xs underline hover:bg-muted transition-colors"
                      title="Underline"
                    >
                      U
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runComposerCommand(entry.channel.id, "removeFormat");
                      }}
                      className="ml-auto rounded-lg bg-muted/50 px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      Clear
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Message composer */}
              <div className="relative rounded-xl bg-background/70 px-3 py-3 text-sm outline-none">
                <div
                  ref={(node) => {
                    composerRefs.current[entry.channel.id] = node;
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) => updateComposerHtml(entry.channel.id, event.currentTarget.innerHTML)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handlePostMessage(entry.team.id, entry.channel.id, drafts[entry.channel.id] ?? "", []);
                    }
                  }}
                  className="min-h-12 max-h-24 overflow-y-auto whitespace-pre-wrap break-words outline-none"
                />
                {!drafts[entry.channel.id] && (
                  <span className="pointer-events-none absolute left-3 top-3 text-muted-foreground/60 text-sm">
                    Type a message...
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-2">
                {/* Format button */}
                <button
                  onClick={() => setShowFormattingToolbar(showFormattingToolbar === entry.channel.id ? null : entry.channel.id)}
                  className="group relative h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 transition-all flex items-center justify-center text-muted-foreground hover:text-primary"
                  title="Text formatting"
                >
                  <Sliders className="h-4 w-4" />
                </button>

                {/* Media button */}
                <label className="group relative h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 transition-all flex items-center justify-center text-muted-foreground hover:text-primary cursor-pointer">
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length === 0) return;
                      await handlePostMessage(entry.team.id, entry.channel.id, drafts[entry.channel.id] ?? "", files);
                      e.target.value = "";
                    }}
                  />
                </label>

                {/* Voice note button */}
                <button
                  onClick={() => {
                    if (isRecording === entry.channel.id) {
                      setIsRecording(null);
                      // TODO: Handle voice recording completion
                    } else {
                      setIsRecording(entry.channel.id);
                    }
                  }}
                  className={cn(
                    "relative h-10 w-10 rounded-full transition-all flex items-center justify-center",
                    isRecording === entry.channel.id
                      ? "bg-red-500/30 text-red-500 animate-pulse"
                      : "bg-gradient-to-br from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 text-muted-foreground hover:text-primary"
                  )}
                  title="Voice note"
                >
                  <Mic className="h-4 w-4" />
                </button>

                {/* Send button */}
                <button
                  onClick={() => void handlePostMessage(entry.team.id, entry.channel.id, drafts[entry.channel.id] ?? "", [])}
                  className="ml-auto h-10 w-10 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-glow/80 flex items-center justify-center transition-shadow disabled:opacity-50"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
};
