export type ChannelType = "text" | "meeting" | "hidden" | "dm";

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
  url: string;
  kind: "image" | "video" | "audio" | "file";
};

export type ChatMessage = {
  id: string;
  author: string;
  authorEmail: string;
  authorName: string;
  text: string;
  html?: string;
  createdAt: string;
  updatedAt?: string;
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
  dmMemberEmail?: string;
  dmMemberName?: string;
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
  time?: string;
  timeFrom?: string;
  timeTo?: string;
  title: string;
  type: WorkspaceEventType;
  scope: EventScope;
  teamId?: string;
  assigneeEmail?: string;
  sourceChannelId?: string;
};

export type DirectMessageThread = {
  id: string;
  memberEmail: string;
  memberName: string;
  messages: ChatMessage[];
};
