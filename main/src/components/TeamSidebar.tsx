import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Hash,
  Search,
  LogOut,
  X,
  Check,
  Video,
  Lock,
  MoreHorizontal,
  Megaphone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { SyncroLogo } from "@/components/SyncroLogo";
import {
  clearWorkspaceStorage,
  readNickname,
  writeNickname,
} from "@/lib/workspace-storage";
import {
  Channel,
  ChannelType,
  Team,
  WorkspaceEvent,
} from "@/types/collab";

type TeamSidebarProps = {
  teams: Team[];
  setTeams: Dispatch<SetStateAction<Team[]>>;
  activeTeamId: string | null;
  setActiveTeamId: Dispatch<SetStateAction<string | null>>;
  events: WorkspaceEvent[];
  onOpenTextChannel: (teamId: string, channelId: string) => void;
  onAddEvent: (event: WorkspaceEvent) => void;
  userEmail: string;
  userDisplayName: string;
  onUserDisplayNameChange: (displayName: string) => void;
};

const GRADIENT_OPTIONS = [
  "from-violet-400 to-fuchsia-400",
  "from-sky-400 to-indigo-400",
  "from-amber-400 to-orange-400",
  "from-emerald-400 to-teal-400",
  "from-rose-400 to-pink-400",
  "from-cyan-400 to-blue-500",
];

const getInitials = (email: string): string => {
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase();
};

const sanitizeChannel = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^#/, "");

const createDefaultTextChannel = (name: string): Channel => ({
  id: crypto.randomUUID(),
  name,
  unread: 0,
  type: "text",
  settings: {
    text: {
      allowAllMedia: true,
      slowModeSeconds: 0,
    },
  },
  messages: [],
});

const channelIcon = (type: ChannelType) => {
  if (type === "meeting") return Video;
  if (type === "hidden") return Lock;
  return Hash;
};

export const TeamSidebar = ({
  teams,
  setTeams,
  activeTeamId,
  setActiveTeamId,
  events,
  onOpenTextChannel,
  onAddEvent,
  userEmail,
  userDisplayName,
  onUserDisplayNameChange,
}: TeamSidebarProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(GRADIENT_OPTIONS[0]);
  const createInputRef = useRef<HTMLInputElement>(null);

  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [newChannelType, setNewChannelType] = useState<ChannelType>("text");
  const channelInputRef = useRef<HTMLInputElement>(null);

  const [settingsTarget, setSettingsTarget] = useState<{
    teamId: string;
    channelId: string;
  } | null>(null);
  const [hiddenAccessInput, setHiddenAccessInput] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState("");

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;
  const isLeader = !!activeTeam && activeTeam.leaderEmail === userEmail;

  const visibleChannels = useMemo(() => {
    if (!activeTeam) return [];
    return activeTeam.channels.filter((channel) => {
      if (channel.type !== "hidden") return true;
      const allowed = channel.settings.hidden?.allowedEmails ?? [];
      return allowed.includes(userEmail) || activeTeam.leaderEmail === userEmail;
    });
  }, [activeTeam, userEmail]);

  const upcomingTeamDeadlines = useMemo(() => {
    if (!activeTeam) return 0;
    const today = startOfDay(new Date());
    return events.filter(
      (e) =>
        e.type === "deadline" &&
        e.scope === "space" &&
        e.teamId === activeTeam.id &&
        (e.date === format(today, "yyyy-MM-dd") ||
          isAfter(parseISO(e.date), today))
    ).length;
  }, [events, activeTeam]);

  const openCreateForm = () => {
    setNewName("");
    setNewColor(GRADIENT_OPTIONS[0]);
    setShowCreateForm(true);
    setTimeout(() => createInputRef.current?.focus(), 80);
  };

  const createTeam = () => {
    const name = newName.trim();
    if (!name) return;
    const team: Team = {
      id: crypto.randomUUID(),
      name,
      color: newColor,
      leaderEmail: userEmail,
      channels: [
        createDefaultTextChannel("general"),
        createDefaultTextChannel("announcements"),
      ],
    };
    setTeams((prev) => [...prev, team]);
    setActiveTeamId(team.id);
    setShowCreateForm(false);
    setNewName("");
    toast.success(`"${name}" created with default channels.`);
  };

  const deleteTeam = (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    if (activeTeamId === id) {
      const remaining = teams.filter((t) => t.id !== id);
      setActiveTeamId(remaining[0]?.id ?? null);
    }
  };

  const updateChannel = (
    teamId: string,
    channelId: string,
    updater: (channel: Channel) => Channel
  ) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id !== teamId
          ? team
          : {
              ...team,
              channels: team.channels.map((channel) =>
                channel.id === channelId ? updater(channel) : channel
              ),
            }
      )
    );
  };

  const addChannel = () => {
    const name = sanitizeChannel(newChannel);
    if (!name || !activeTeamId) return;

    const channel: Channel = {
      id: crypto.randomUUID(),
      name,
      unread: 0,
      type: newChannelType,
      settings: {
        text:
          newChannelType === "text"
            ? { allowAllMedia: true, slowModeSeconds: 0 }
            : undefined,
        meeting:
          newChannelType === "meeting"
            ? {
                voiceEnabled: true,
                screenshareEnabled: true,
                schedules: [],
              }
            : undefined,
        hidden:
          newChannelType === "hidden"
            ? {
                allowedEmails: [userEmail],
              }
            : undefined,
      },
      messages: [],
    };

    setTeams((prev) =>
      prev.map((team) =>
        team.id === activeTeamId
          ? { ...team, channels: [...team.channels, channel] }
          : team
      )
    );

    setNewChannel("");
    setNewChannelType("text");
    setAddingChannel(false);
  };

  const deleteChannel = (teamId: string, channelId: string) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id !== teamId
          ? team
          : {
              ...team,
              channels: team.channels.filter((c) => c.id !== channelId),
            }
      )
    );
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out", { description: "See you next time." });
    navigate("/login", { replace: true });
  };

  const selectedChannel = useMemo(() => {
    if (!settingsTarget) return null;
    const team = teams.find((t) => t.id === settingsTarget.teamId);
    if (!team) return null;
    const channel = team.channels.find((c) => c.id === settingsTarget.channelId);
    if (!channel) return null;
    return { team, channel };
  }, [settingsTarget, teams]);

  useEffect(() => {
    setProfileDraft(readNickname(userEmail) || userDisplayName || userEmail);
  }, [userEmail, userDisplayName, profileOpen]);

  const displayName = userDisplayName || userEmail;
  const initials = getInitials(displayName || userEmail);

  const handleSaveProfile = () => {
    const nextName = profileDraft.trim();
    writeNickname(userEmail, nextName);
    onUserDisplayNameChange(nextName || userEmail);
    setProfileOpen(false);
    toast.success("Profile updated.");
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your local account data and sign out? This clears saved workspace data from this browser."
    );
    if (!confirmed) return;

    clearWorkspaceStorage(userEmail);
    onUserDisplayNameChange(userEmail);
    setProfileOpen(false);
    await signOut();
    navigate("/login", { replace: true });
    toast.success("Account data cleared.");
  };

  const saveScheduledMeeting = () => {
    if (!selectedChannel || selectedChannel.channel.type !== "meeting") return;
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) return;

    const schedule = {
      id: crypto.randomUUID(),
      title: meetingTitle.trim(),
      date: meetingDate,
      time: meetingTime,
      durationMins: meetingDuration,
    };

    updateChannel(selectedChannel.team.id, selectedChannel.channel.id, (channel) => ({
      ...channel,
      settings: {
        ...channel.settings,
        meeting: {
          voiceEnabled: channel.settings.meeting?.voiceEnabled ?? true,
          screenshareEnabled: channel.settings.meeting?.screenshareEnabled ?? true,
          schedules: [...(channel.settings.meeting?.schedules ?? []), schedule],
        },
      },
    }));

    onAddEvent({
      id: crypto.randomUUID(),
      date: meetingDate,
      title: `${meetingTitle.trim()} (${selectedChannel.channel.name})`,
      type: "meetingReminder",
      scope: "space",
      teamId: selectedChannel.team.id,
      sourceChannelId: selectedChannel.channel.id,
    });

    setMeetingTitle("");
    setMeetingDate("");
    setMeetingTime("");
    setMeetingDuration(30);
    toast.success("Meeting scheduled and calendar reminder added.");
  };

  const email = user?.email ?? "";

  return (
    <>
      <aside className="flex h-full w-80 shrink-0 flex-col gap-4 p-4">
        <div className="glass shadow-soft flex items-center gap-3 rounded-3xl px-4 py-3">
          <div className="shadow-glow h-12 w-12 overflow-hidden rounded-2xl bg-white/70 p-0.5">
            <SyncroLogo className="h-full w-full" />
          </div>
          <div className="leading-tight">
            <h1 className="bg-gradient-to-r from-primary via-fuchsia-500 to-cyan-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
              Syncro
            </h1>
            <p className="text-muted-foreground text-[10px] font-medium">made by V-designs</p>
          </div>
        </div>

        <div className="glass shadow-soft flex items-center gap-2 rounded-2xl px-4 py-2.5">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" />
          <input
            placeholder="Jump to..."
            className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="glass shadow-soft flex-1 overflow-y-auto rounded-3xl p-3">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Spaces
            </span>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
              {teams.length}
            </span>
          </div>

          {teams.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="bg-muted grid h-10 w-10 place-items-center overflow-hidden rounded-2xl p-0.5">
                <SyncroLogo className="h-full w-full" />
              </div>
              <p className="text-muted-foreground text-xs font-medium">
                No spaces yet
              </p>
              <p className="text-muted-foreground/60 text-[11px]">
                Create your first space below
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {teams.map((team, i) => {
              const isActive = team.id === activeTeamId;
              const initial = team.name[0]?.toUpperCase() ?? "?";
              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group/team relative"
                >
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTeamId(isActive ? null : team.id)}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all",
                      isActive ? "bg-primary/10 shadow-soft" : "hover:bg-muted/60"
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeTeam"
                        className="bg-primary absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
                      />
                    )}
                    <div
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-soft",
                        team.color
                      )}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", isActive && "text-primary")}>
                        {team.name}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {team.channels.length} channels
                      </p>
                    </div>
                  </motion.button>

                  <button
                    onClick={() => deleteTeam(team.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/team:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              );
            })}
          </div>

          <AnimatePresence>
            {activeTeam && (
              <motion.div
                key={activeTeam.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-5"
              >
                <div className="mb-2 px-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Channels
                  </span>
                </div>

                <div className="space-y-0.5">
                  {visibleChannels.map((c) => {
                    const Icon = channelIcon(c.type);
                    const unread =
                      c.name === "announcements" ? upcomingTeamDeadlines : c.unread;

                    return (
                      <div key={c.id} className="group/ch relative">
                        <button
                          onClick={() => {
                            if (c.type === "text") {
                              onOpenTextChannel(activeTeam.id, c.id);
                            }
                          }}
                          className="hover:bg-muted/60 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="text-muted-foreground h-3.5 w-3.5" />
                            <span className="text-foreground/80 hover:text-foreground">
                              {c.name}
                            </span>
                            {c.name === "announcements" && (
                              <Megaphone className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>

                          <span className="flex items-center gap-1.5">
                            {unread > 0 && (
                              <span className="bg-primary text-primary-foreground min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold">
                                {unread}
                              </span>
                            )}
                          </span>
                        </button>

                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 transition-opacity group-hover/ch:opacity-100">
                          <button
                            onClick={() => setSettingsTarget({ teamId: activeTeam.id, channelId: c.id })}
                            className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>

                          {activeTeam.channels.length > 2 && (
                            <button
                              onClick={() => deleteChannel(activeTeam.id, c.id)}
                              className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <AnimatePresence>
                    {addingChannel ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Hash className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <input
                              ref={channelInputRef}
                              autoFocus
                              value={newChannel}
                              onChange={(e) => setNewChannel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addChannel();
                                if (e.key === "Escape") {
                                  setAddingChannel(false);
                                  setNewChannel("");
                                }
                              }}
                              placeholder="channel-name"
                              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                            />
                          </div>

                          <select
                            value={newChannelType}
                            onChange={(e) => setNewChannelType(e.target.value as ChannelType)}
                            className="glass w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                          >
                            <option value="text">Text channel</option>
                            <option value="meeting">Team meeting channel</option>
                            <option value="hidden">Hidden channel</option>
                          </select>

                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setAddingChannel(false);
                                setNewChannel("");
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={addChannel}
                              className="bg-primary text-primary-foreground grid h-5 w-5 place-items-center rounded-md"
                            >
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <button
                        onClick={() => setAddingChannel(true)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all"
                      >
                        <Plus className="h-3 w-3" />
                        Add channel type
                      </button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              key="create-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="glass shadow-soft rounded-2xl p-3">
                <p className="mb-2 px-1 text-xs font-semibold">New Space</p>
                <input
                  ref={createInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createTeam();
                    if (e.key === "Escape") setShowCreateForm(false);
                  }}
                  placeholder="Space name..."
                  className="glass placeholder:text-muted-foreground/60 mb-3 w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />

                <div className="mb-3 flex gap-1.5 px-1">
                  {GRADIENT_OPTIONS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setNewColor(g)}
                      className={cn(
                        "h-5 w-5 rounded-full bg-gradient-to-br transition-transform",
                        g,
                        newColor === g
                          ? "scale-125 ring-2 ring-offset-1 ring-white/60"
                          : "opacity-60 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="text-muted-foreground hover:bg-muted/60 flex-1 rounded-xl py-2 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createTeam}
                    disabled={!newName.trim()}
                    className="bg-gradient-primary text-primary-foreground shadow-glow flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {user && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass shadow-soft flex items-center gap-3 rounded-2xl px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="bg-gradient-primary shadow-glow grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium leading-tight">{displayName}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="bg-success h-1.5 w-1.5 rounded-full" />
                  <p className="text-muted-foreground text-[10px]">{email || userEmail}</p>
                </div>
              </div>
            </button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSignOut}
              title="Sign out"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </motion.button>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={openCreateForm}
          className="bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create New Space
        </motion.button>
      </aside>

      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 p-4 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong shadow-float w-full max-w-md rounded-3xl p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Your profile</h3>
                  <p className="text-muted-foreground text-xs">Nickname and account actions</p>
                </div>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="text-muted-foreground hover:text-foreground rounded-lg p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="glass rounded-2xl px-3 py-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Nickname</p>
                  <input
                    value={profileDraft}
                    onChange={(e) => setProfileDraft(e.target.value)}
                    placeholder={userEmail}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>

                <div className="rounded-2xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Signed in as {email || userEmail}.
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="glass hover:bg-muted/60 flex-1 rounded-2xl py-3 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="bg-gradient-primary text-primary-foreground shadow-glow flex-1 rounded-2xl py-3 text-sm font-semibold"
                  >
                    Save
                  </button>
                </div>

                <button
                  onClick={handleDeleteAccount}
                  className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  Delete account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedChannel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 p-4 backdrop-blur-sm"
            onClick={() => setSettingsTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong shadow-float w-full max-w-md rounded-3xl p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">#{selectedChannel.channel.name} settings</h3>
                  <p className="text-muted-foreground text-xs uppercase">
                    {selectedChannel.channel.type} channel
                  </p>
                </div>
                <button
                  onClick={() => setSettingsTarget(null)}
                  className="text-muted-foreground hover:text-foreground rounded-lg p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selectedChannel.channel.type === "text" && (
                <div className="space-y-3">
                  <label className="glass flex items-center justify-between rounded-2xl px-3 py-2 text-sm">
                    <span>Allow all media uploads</span>
                    <input
                      type="checkbox"
                      checked={selectedChannel.channel.settings.text?.allowAllMedia ?? true}
                      onChange={(e) =>
                        updateChannel(
                          selectedChannel.team.id,
                          selectedChannel.channel.id,
                          (channel) => ({
                            ...channel,
                            settings: {
                              ...channel.settings,
                              text: {
                                allowAllMedia: e.target.checked,
                                slowModeSeconds: channel.settings.text?.slowModeSeconds ?? 0,
                              },
                            },
                          })
                        )
                      }
                    />
                  </label>

                  <label className="glass block rounded-2xl px-3 py-2 text-sm">
                    <span className="mb-2 block">Slow mode (seconds)</span>
                    <input
                      type="number"
                      min={0}
                      value={selectedChannel.channel.settings.text?.slowModeSeconds ?? 0}
                      onChange={(e) => {
                        const value = Math.max(0, Number(e.target.value) || 0);
                        updateChannel(
                          selectedChannel.team.id,
                          selectedChannel.channel.id,
                          (channel) => ({
                            ...channel,
                            settings: {
                              ...channel.settings,
                              text: {
                                allowAllMedia: channel.settings.text?.allowAllMedia ?? true,
                                slowModeSeconds: value,
                              },
                            },
                          })
                        );
                      }}
                      className="w-full rounded-xl bg-background/50 px-3 py-2 text-sm outline-none"
                    />
                  </label>
                </div>
              )}

              {selectedChannel.channel.type === "meeting" && (
                <div className="space-y-3">
                  <label className="glass flex items-center justify-between rounded-2xl px-3 py-2 text-sm">
                    <span>Voice chat enabled</span>
                    <input
                      type="checkbox"
                      checked={selectedChannel.channel.settings.meeting?.voiceEnabled ?? true}
                      onChange={(e) =>
                        updateChannel(
                          selectedChannel.team.id,
                          selectedChannel.channel.id,
                          (channel) => ({
                            ...channel,
                            settings: {
                              ...channel.settings,
                              meeting: {
                                voiceEnabled: e.target.checked,
                                screenshareEnabled:
                                  channel.settings.meeting?.screenshareEnabled ?? true,
                                schedules: channel.settings.meeting?.schedules ?? [],
                              },
                            },
                          })
                        )
                      }
                    />
                  </label>

                  <label className="glass flex items-center justify-between rounded-2xl px-3 py-2 text-sm">
                    <span>Screenshare enabled</span>
                    <input
                      type="checkbox"
                      checked={selectedChannel.channel.settings.meeting?.screenshareEnabled ?? true}
                      onChange={(e) =>
                        updateChannel(
                          selectedChannel.team.id,
                          selectedChannel.channel.id,
                          (channel) => ({
                            ...channel,
                            settings: {
                              ...channel.settings,
                              meeting: {
                                voiceEnabled: channel.settings.meeting?.voiceEnabled ?? true,
                                screenshareEnabled: e.target.checked,
                                schedules: channel.settings.meeting?.schedules ?? [],
                              },
                            },
                          })
                        )
                      }
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        toast.success("Voice room started", {
                          description: "Teammates can join from this meeting channel.",
                        })
                      }
                      className="bg-gradient-primary text-primary-foreground rounded-xl py-2 text-xs font-semibold"
                    >
                      Start voice chat
                    </button>
                    <button
                      onClick={() =>
                        toast.success("Screenshare started", {
                          description: "Screen is now shared in this meeting channel.",
                        })
                      }
                      className="rounded-xl bg-muted py-2 text-xs font-semibold"
                    >
                      Start screenshare
                    </button>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Schedule meeting
                    </p>
                    <div className="space-y-2">
                      <input
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder="Meeting title"
                        className="w-full rounded-xl bg-background/50 px-3 py-2 text-sm outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          className="rounded-xl bg-background/50 px-3 py-2 text-sm outline-none"
                        />
                        <input
                          type="time"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          className="rounded-xl bg-background/50 px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={meetingDuration}
                        onChange={(e) => setMeetingDuration(Math.max(15, Number(e.target.value) || 15))}
                        placeholder="Duration mins"
                        className="w-full rounded-xl bg-background/50 px-3 py-2 text-sm outline-none"
                      />
                      <button
                        onClick={saveScheduledMeeting}
                        className="bg-gradient-primary text-primary-foreground w-full rounded-xl py-2 text-sm font-semibold"
                      >
                        Schedule + add calendar reminder
                      </button>
                    </div>
                  </div>

                  <div className="max-h-28 space-y-1 overflow-y-auto">
                    {(selectedChannel.channel.settings.meeting?.schedules ?? []).map((meeting) => (
                      <div key={meeting.id} className="rounded-xl bg-muted/60 px-3 py-2 text-xs">
                        <p className="font-medium">{meeting.title}</p>
                        <p className="text-muted-foreground">
                          {meeting.date} at {meeting.time} ({meeting.durationMins}m)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedChannel.channel.type === "hidden" && (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    Hidden channel visibility is controlled by team leader.
                  </div>

                  {!isLeader && (
                    <div className="rounded-2xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      You can view current access but only leader can edit.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {(selectedChannel.channel.settings.hidden?.allowedEmails ?? []).map((allowed) => (
                      <span key={allowed} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px]">
                        {allowed}
                        {isLeader && allowed !== selectedChannel.team.leaderEmail && (
                          <button
                            onClick={() =>
                              updateChannel(
                                selectedChannel.team.id,
                                selectedChannel.channel.id,
                                (channel) => ({
                                  ...channel,
                                  settings: {
                                    ...channel.settings,
                                    hidden: {
                                      allowedEmails: (channel.settings.hidden?.allowedEmails ?? []).filter(
                                        (mail) => mail !== allowed
                                      ),
                                    },
                                  },
                                })
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {isLeader && (
                    <div className="flex gap-2">
                      <input
                        value={hiddenAccessInput}
                        onChange={(e) => setHiddenAccessInput(e.target.value)}
                        placeholder="teammate@email.com"
                        className="w-full rounded-xl bg-background/50 px-3 py-2 text-sm outline-none"
                      />
                      <button
                        onClick={() => {
                          const emailToAdd = hiddenAccessInput.trim().toLowerCase();
                          if (!emailToAdd.includes("@")) return;
                          updateChannel(
                            selectedChannel.team.id,
                            selectedChannel.channel.id,
                            (channel) => {
                              const current = channel.settings.hidden?.allowedEmails ?? [];
                              if (current.includes(emailToAdd)) return channel;
                              return {
                                ...channel,
                                settings: {
                                  ...channel.settings,
                                  hidden: {
                                    allowedEmails: [...current, emailToAdd],
                                  },
                                },
                              };
                            }
                          );
                          setHiddenAccessInput("");
                        }}
                        className="bg-primary text-primary-foreground rounded-xl px-3"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
