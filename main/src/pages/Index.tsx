import { useEffect, useMemo, useState } from "react";
import { TeamSidebar } from "@/components/TeamSidebar";
import { PulseCalendar } from "@/components/PulseCalendar";
import { SocialPanel } from "@/components/SocialPanel";
import { NotificationsDock } from "@/components/NotificationsDock";
import { useAuth } from "@/context/AuthContext";
import {
  Channel,
  Team,
  WorkspaceEvent,
} from "@/types/collab";

const TEAMS_KEY = "mesh_teams";
const ACTIVE_KEY = "mesh_active_team";
const EVENTS_KEY = "mesh_calendar_events";

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

const normalizeTeam = (raw: Team, fallbackLeader: string): Team => {
  const channels = (raw.channels || []).map((channel) => ({
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
    messages: channel.messages ?? [],
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

const Index = () => {
  const { user } = useAuth();
  const userEmail = user?.email ?? "demo@syncro.app";

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
      }));
    } catch {
      return [];
    }
  });
  const [openTextChannels, setOpenTextChannels] = useState<
    Array<{ teamId: string; channelId: string }>
  >([]);

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
        />
        <PulseCalendar
          events={events}
          setEvents={setEvents}
          teams={teams}
          activeTeam={activeTeam}
          openTextChannels={openTextChannels}
          closeTextChannel={closeChannelChat}
          setTeams={setTeams}
          userEmail={userEmail}
        />
        <SocialPanel
          activeTeam={activeTeam}
          setTeams={setTeams}
          onOpenTextChannel={openChannelChat}
          userEmail={userEmail}
        />
      </div>
      <NotificationsDock events={events} teams={teams} />
    </>
  );
};

export default Index;
