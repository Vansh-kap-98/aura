import { useEffect, useMemo, useState } from "react";
import { TeamSidebar } from "@/components/TeamSidebar";
import { PulseCalendar } from "@/components/PulseCalendar";
import { SocialPanel } from "@/components/SocialPanel";
import { NotificationsDock } from "@/components/NotificationsDock";
import { useAuth } from "@/context/AuthContext";
import { readNickname } from "@/lib/workspace-storage";
import {
  Channel,
  Team,
  WorkspaceEvent,
  ChatMessage,
  DirectMessageThread,
} from "@/types/collab";

const TEAMS_KEY = "mesh_teams";
const ACTIVE_KEY = "mesh_active_team";
const EVENTS_KEY = "mesh_calendar_events";
const CALENDAR_SPACES_KEY = "mesh_calendar_selected_spaces";
const DM_THREADS_KEY = "mesh_direct_threads";
const DEMO_MEMBER_EMAIL = "teammate.demo@syncro.app";
const DEMO_AUTO_REPLY = "hi";

const createDefaultChannel = (name: string): Channel => ({
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

const normalizeChatMessage = (
  message: Partial<ChatMessage> & { author?: string },
  fallbackAuthorEmail: string,
  fallbackAuthorName: string
): ChatMessage => ({
  id: message.id ?? crypto.randomUUID(),
  author: message.author ?? fallbackAuthorName,
  authorEmail: message.authorEmail ?? message.author ?? fallbackAuthorEmail,
  authorName: message.authorName ?? message.author ?? fallbackAuthorName,
  text: message.text ?? "",
  html: message.html,
  createdAt: message.createdAt ?? new Date().toISOString(),
  updatedAt: message.updatedAt,
  media: (message.media ?? []).map((media) => ({
    id: media.id ?? crypto.randomUUID(),
    name: media.name ?? "attachment",
    type: media.type ?? "application/octet-stream",
    size: media.size ?? 0,
    url: media.url ?? "",
    kind: media.kind ?? "file",
  })),
});

const normalizeTeam = (raw: Team, fallbackLeader: string): Team => {
  const channels = (raw.channels || [])
    .filter((channel) => channel.type !== "dm")
    .map((channel) => ({
    ...channel,
    type: channel.type ?? "text",
    settings: {
      text:
        channel.type === "text" || !channel.type
          ? {
              allowAllMedia:
                channel.settings?.text?.allowAllMedia ?? true,
              slowModeSeconds:
                channel.settings?.text?.slowModeSeconds ?? 0,
            }
          : channel.settings?.text,
      meeting:
        channel.type === "meeting"
          ? {
              voiceEnabled: channel.settings?.meeting?.voiceEnabled ?? true,
              screenshareEnabled:
                channel.settings?.meeting?.screenshareEnabled ?? true,
              schedules: channel.settings?.meeting?.schedules ?? [],
            }
          : channel.settings?.meeting,
      hidden:
        channel.type === "hidden"
          ? {
              allowedEmails:
                channel.settings?.hidden?.allowedEmails ?? [
                  raw.leaderEmail || fallbackLeader,
                ],
            }
          : channel.settings?.hidden,
    },
    messages: (channel.messages ?? []).map((message) =>
      normalizeChatMessage(message, fallbackLeader, fallbackLeader)
    ),
  }));

  const hasGeneral = channels.some((c) => c.name === "general");
  const hasAnnouncements = channels.some((c) => c.name === "announcements");

  return {
    ...raw,
    leaderEmail: raw.leaderEmail || fallbackLeader,
    channels: [
      ...(hasGeneral ? [] : [createDefaultChannel("general")]),
      ...(hasAnnouncements ? [] : [createDefaultChannel("announcements")]),
      ...channels,
    ],
  };
};

const normalizeDirectThread = (
  raw: Partial<DirectMessageThread> & { memberEmail?: string },
  fallbackAuthorEmail: string
): DirectMessageThread => ({
  id: raw.id ?? crypto.randomUUID(),
  memberEmail: raw.memberEmail ?? "unknown@syncro.app",
  memberName: raw.memberName ?? raw.memberEmail ?? "Unknown",
  messages: (raw.messages ?? []).map((message) =>
    normalizeChatMessage(message, fallbackAuthorEmail, fallbackAuthorEmail)
  ),
});

const Index = () => {
  const { user } = useAuth();
  const userEmail = user?.email ?? "demo@syncro.app";
  const [userDisplayName, setUserDisplayName] = useState(
    () => readNickname(userEmail) || userEmail
  );

  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(TEAMS_KEY) || "[]") as Team[];
      return parsed.map((team) => normalizeTeam(team, userEmail));
    } catch {
      return [];
    }
  });
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_KEY)
  );
  const [events, setEvents] = useState<WorkspaceEvent[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]") as WorkspaceEvent[];
      return parsed.map((e) => ({
        ...e,
        scope: e.scope ?? "personal",
        assigneeEmail: e.assigneeEmail ?? userEmail,
      }));
    } catch {
      return [];
    }
  });
  const [selectedCalendarTeamIds, setSelectedCalendarTeamIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CALENDAR_SPACES_KEY) || "[]") as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [openTextChannels, setOpenTextChannels] = useState<
    Array<{ teamId: string; channelId: string }>
  >([]);
  const [directThreads, setDirectThreads] = useState<DirectMessageThread[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(DM_THREADS_KEY) || "[]") as Array<
        Partial<DirectMessageThread>
      >;
      return parsed.map((thread) => normalizeDirectThread(thread, userEmail));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setUserDisplayName(readNickname(userEmail) || userEmail);
  }, [userEmail]);

  useEffect(() => {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    if (activeTeamId) {
      localStorage.setItem(ACTIVE_KEY, activeTeamId);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, [activeTeamId]);

  useEffect(() => {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(CALENDAR_SPACES_KEY, JSON.stringify(selectedCalendarTeamIds));
  }, [selectedCalendarTeamIds]);

  useEffect(() => {
    localStorage.setItem(DM_THREADS_KEY, JSON.stringify(directThreads));
  }, [directThreads]);

  const activeTeam = useMemo(
    () => teams.find((team) => team.id === activeTeamId) ?? null,
    [teams, activeTeamId]
  );

  const openChannelChat = (teamId: string, channelId: string) => {
    setOpenTextChannels((prev) => {
      if (prev.some((p) => p.teamId === teamId && p.channelId === channelId)) {
        return prev;
      }
      return [...prev, { teamId, channelId }];
    });
  };

  const closeChannelChat = (teamId: string, channelId: string) => {
    setOpenTextChannels((prev) =>
      prev.filter((p) => !(p.teamId === teamId && p.channelId === channelId))
    );
  };

  const openDirectChat = (memberEmail: string, memberName?: string) => {
    const normalizedEmail = memberEmail.trim().toLowerCase();
    if (!normalizedEmail) return;

    setDirectThreads((prev) => {
      const existing = prev.find((thread) => thread.memberEmail === normalizedEmail);
      if (existing) {
        if (normalizedEmail !== DEMO_MEMBER_EMAIL) return prev;
        const alreadyHasReply = existing.messages.some(
          (message) =>
            message.authorEmail === DEMO_MEMBER_EMAIL &&
            message.text.toLowerCase() === DEMO_AUTO_REPLY
        );
        if (alreadyHasReply) return prev;
        return prev.map((thread) =>
          thread.memberEmail !== normalizedEmail
            ? thread
            : {
                ...thread,
                messages: [
                  ...thread.messages,
                  {
                    id: crypto.randomUUID(),
                    author: DEMO_MEMBER_EMAIL,
                    authorEmail: DEMO_MEMBER_EMAIL,
                    authorName: DEMO_MEMBER_EMAIL,
                    text: DEMO_AUTO_REPLY,
                    createdAt: new Date().toISOString(),
                    media: [],
                  },
                ],
              }
        );
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          memberEmail: normalizedEmail,
          memberName: memberName || normalizedEmail,
          messages:
            normalizedEmail === DEMO_MEMBER_EMAIL
              ? [
                  {
                    id: crypto.randomUUID(),
                    author: DEMO_MEMBER_EMAIL,
                    authorEmail: DEMO_MEMBER_EMAIL,
                    authorName: DEMO_MEMBER_EMAIL,
                    text: DEMO_AUTO_REPLY,
                    createdAt: new Date().toISOString(),
                    media: [],
                  },
                ]
              : [],
        },
      ];
    });

    setOpenTextChannels((prev) => {
      const exists = prev.some(
        (entry) => entry.teamId === "__dm__" && entry.channelId === normalizedEmail
      );
      if (exists) return prev;
      return [...prev, { teamId: "__dm__", channelId: normalizedEmail }];
    });
  };

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden">
        <TeamSidebar
          teams={teams}
          setTeams={setTeams}
          activeTeamId={activeTeamId}
          setActiveTeamId={setActiveTeamId}
          events={events}
          onOpenTextChannel={openChannelChat}
          onAddEvent={(event) => setEvents((prev) => [...prev, event])}
          userEmail={userEmail}
          userDisplayName={userDisplayName}
          onUserDisplayNameChange={setUserDisplayName}
        />
        <PulseCalendar
          events={events}
          setEvents={setEvents}
          teams={teams}
          activeTeam={activeTeam}
          selectedCalendarTeamIds={selectedCalendarTeamIds}
          setSelectedCalendarTeamIds={setSelectedCalendarTeamIds}
          openTextChannels={openTextChannels}
          closeTextChannel={closeChannelChat}
          setTeams={setTeams}
          directThreads={directThreads}
          setDirectThreads={setDirectThreads}
          userEmail={userEmail}
          userDisplayName={userDisplayName}
        />
        <SocialPanel
          activeTeam={activeTeam}
          onOpenDirectMessage={openDirectChat}
          userEmail={userEmail}
          userDisplayName={userDisplayName}
        />
      </div>
      <NotificationsDock events={events} teams={teams} />
    </>
  );
};

export default Index;
