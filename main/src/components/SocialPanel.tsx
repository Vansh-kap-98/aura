import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  TrendingUp,
  Users,
  Copy,
  Check,
  X,
  Video,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Channel, Team } from "@/types/collab";

// Derive a consistent gradient from an email string
const getColorFromEmail = (email: string): string => {
  const gradients = [
    "from-rose-400 to-pink-500",
    "from-sky-400 to-indigo-500",
    "from-amber-400 to-orange-500",
    "from-violet-400 to-fuchsia-500",
    "from-emerald-400 to-teal-500",
    "from-cyan-400 to-blue-500",
  ];
  const hash = Array.from(email).reduce(
    (acc, c) => acc + c.charCodeAt(0),
    0
  );
  return gradients[hash % gradients.length];
};

const getInitials = (email: string): string => {
  const local = email.split("@")[0];
  const parts = local.split(/[._\-+]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase();
};

// Static vibe bars — decorative chart
const VIBE_BARS = [40, 55, 35, 60, 75, 50, 85, 90, 70, 95, 80, 88];

type SocialPanelProps = {
  activeTeam: Team | null;
  setTeams: Dispatch<SetStateAction<Team[]>>;
  onOpenTextChannel: (teamId: string, channelId: string) => void;
  userEmail: string;
};

const sanitizeChannel = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^#/, "");

const isPrivateDmFor = (channel: Channel, userA: string, userB: string) => {
  const allowed = channel.settings.hidden?.allowedEmails ?? [];
  if (allowed.length !== 2) return false;
  return allowed.includes(userA) && allowed.includes(userB);
};

export const SocialPanel = ({
  activeTeam,
  setTeams,
  onOpenTextChannel,
  userEmail,
}: SocialPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const email = userEmail;
  const initials = getInitials(email);
  const color = getColorFromEmail(email);

  const onlinePeers = useMemo(() => {
    if (!activeTeam) return [] as Array<{ email: string; isLeader: boolean }>;
    const emails = new Set<string>();
    emails.add(activeTeam.leaderEmail);

    activeTeam.channels.forEach((channel) => {
      channel.messages.forEach((message) => {
        if (message.author) emails.add(message.author);
      });
      const allowed = channel.settings.hidden?.allowedEmails ?? [];
      allowed.forEach((memberEmail) => {
        if (memberEmail) emails.add(memberEmail);
      });
    });

    emails.delete(userEmail);

    return Array.from(emails)
      .map((peerEmail) => ({
        email: peerEmail,
        isLeader: peerEmail === activeTeam.leaderEmail,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [activeTeam, userEmail]);

  const handlePrivateChat = (targetEmail: string) => {
    if (!activeTeam) {
      toast.error("Select a space before starting a private chat.");
      return;
    }

    const existing = activeTeam.channels.find((channel) =>
      isPrivateDmFor(channel, userEmail, targetEmail)
    );

    const channelId = existing?.id ?? crypto.randomUUID();

    if (!existing) {
      const dmChannel: Channel = {
        id: channelId,
        name: `dm-${sanitizeChannel(targetEmail.split("@")[0] || targetEmail)}`,
        unread: 0,
        type: "text",
        settings: {
          text: {
            allowAllMedia: true,
            slowModeSeconds: 0,
          },
          hidden: {
            allowedEmails: [userEmail, targetEmail],
          },
        },
        messages: [],
      };

      setTeams((prev) =>
        prev.map((team) =>
          team.id === activeTeam.id
            ? { ...team, channels: [...team.channels, dmChannel] }
            : team
        )
      );
    }

    onOpenTextChannel(activeTeam.id, channelId);
  };

  const handleCall = (targetEmail: string) => {
    if (!activeTeam) {
      toast.error("Select a space before starting a call.");
      return;
    }
    const room = `syncro-${activeTeam.id}-${sanitizeChannel(targetEmail)}`;
    window.open(`https://meet.jit.si/${room}`, "_blank", "noopener,noreferrer");
    toast.success(`Calling ${targetEmail}`);
  };

  const handleCopyInvite = async () => {
    const link = `${window.location.origin}/signup`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied!", {
        description: "Share it with your teammates.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link. Please copy the URL manually.");
    }
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-4 p-4 pl-0">
      {/* ── Team vibe chart ── */}
      <div className="glass shadow-soft rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-success h-4 w-4" />
            <span className="text-sm font-semibold">Your momentum</span>
          </div>
          <span className="text-success text-xs font-semibold">This week</span>
        </div>
        <div className="flex h-12 items-end gap-1">
          {VIBE_BARS.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 100 }}
              className={cn(
                "flex-1 rounded-full bg-gradient-to-t",
                i === VIBE_BARS.length - 1
                  ? "from-primary to-primary-glow shadow-glow"
                  : "from-muted-foreground/30 to-muted-foreground/10"
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Online now ── */}
      <div className="glass shadow-soft flex-1 overflow-y-auto rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Online now</h3>
          <span className="bg-success/15 text-success rounded-full px-2 py-0.5 text-[10px] font-bold">
            {onlinePeers.length + (email ? 1 : 0)} online
          </span>
        </div>

        {/* Current user */}
        {email && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="group flex items-center gap-3 rounded-2xl p-2 transition-all hover:bg-success/5"
          >
            <div className="relative">
              <div
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-xs font-bold text-white shadow-soft",
                  color
                )}
              >
                {initials}
              </div>
              <span className="border-card absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2">
                <span className="pulse-dot relative h-2.5 w-2.5 rounded-full bg-success" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {email}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                That's you · Active now
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => toast.info("You are already in your own space.")}
                className="hover:bg-primary hover:text-primary-foreground press grid h-8 w-8 place-items-center rounded-xl transition-colors"
              >
                <Video className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => toast.info("Use teammates list to start a private chat.")}
                className="hover:bg-muted press grid h-8 w-8 place-items-center rounded-xl transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        <div className="mt-5">
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
            Teammates
          </h3>
          {onlinePeers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-8 text-center">
              <div className="bg-muted grid h-10 w-10 place-items-center rounded-2xl">
                <Users className="text-muted-foreground h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">No teammates yet</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Invite people to see their status here
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCopyInvite}
                className="bg-gradient-primary text-primary-foreground shadow-glow flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
                {copied ? "Copied!" : "Copy invite link"}
              </motion.button>
            </div>
          ) : (
            <div className="space-y-2">
              {onlinePeers.map((peer) => {
                const peerInitials = getInitials(peer.email);
                const peerColor = getColorFromEmail(peer.email);

                return (
                  <motion.div
                    key={peer.email}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex items-center gap-3 rounded-2xl p-2 transition-all hover:bg-success/5"
                  >
                    <div className="relative">
                      <div
                        className={cn(
                          "grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-xs font-bold text-white shadow-soft",
                          peerColor
                        )}
                      >
                        {peerInitials}
                      </div>
                      <span className="border-card absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2">
                        <span className="pulse-dot relative h-2.5 w-2.5 rounded-full bg-success" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {peer.email}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {peer.isLeader ? "Team leader" : "Active now"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleCall(peer.email)}
                        className="hover:bg-primary hover:text-primary-foreground press grid h-8 w-8 place-items-center rounded-xl transition-colors"
                        title={`Call ${peer.email}`}
                      >
                        <Video className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handlePrivateChat(peer.email)}
                        className="hover:bg-muted press grid h-8 w-8 place-items-center rounded-xl transition-colors"
                        title={`Message ${peer.email}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Sync modal ── */}
      <AnimatePresence>
        {showSyncModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/5 p-4 backdrop-blur-sm"
            onClick={() => setShowSyncModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong shadow-float w-full max-w-xs rounded-3xl p-6 text-center"
            >
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-muted-foreground hover:text-foreground absolute right-4 top-4"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="bg-gradient-accent shadow-glow mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl">
                <Zap className="h-6 w-6 text-white" fill="white" strokeWidth={2} />
              </div>
              <h3 className="mb-1 font-semibold">Quick Sync</h3>
              <p className="text-muted-foreground mb-5 text-sm">
                Invite teammates first — then start an instant video sync with
                whoever's free.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setShowSyncModal(false);
                  handleCopyInvite();
                }}
                className="bg-gradient-primary text-primary-foreground shadow-glow w-full rounded-2xl py-3 text-sm font-semibold"
              >
                Copy invite link
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
