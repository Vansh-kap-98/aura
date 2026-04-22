export type ChannelType = "text" | "meeting" | "hidden";

export type EventScope = "personal" | "space";

export type WorkspaceEventType =
  | "meeting"
  | "deadline"
  | "focus"
  | "social"
  | "meetingReminder";

export type ChatMedia = {
  id: string;
  name: string;
  type: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  media: ChatMedia[];
};

export type MeetingSchedule = {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMins: number;
  notes?: string;
};

export type TextChannelSettings = {
  allowAllMedia: boolean;
  slowModeSeconds: number;
};

export type MeetingChannelSettings = {
  voiceEnabled: boolean;
  screenshareEnabled: boolean;
  schedules: MeetingSchedule[];
};

export type HiddenChannelSettings = {
  allowedEmails: string[];
};

export type ChannelSettings = {
  text?: TextChannelSettings;
  meeting?: MeetingChannelSettings;
  hidden?: HiddenChannelSettings;
};

export type Channel = {
  id: string;
  name: string;
  unread: number;
  type: ChannelType;
  settings: ChannelSettings;
  messages: ChatMessage[];
};

export type Team = {
  id: string;
  name: string;
  color: string;
  leaderEmail: string;
  channels: Channel[];
};

export type WorkspaceEvent = {
  id: string;
  date: string;
  title: string;
  type: WorkspaceEventType;
  scope: EventScope;
  teamId?: string;
  sourceChannelId?: string;
};
