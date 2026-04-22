export const TEAMS_KEY = "mesh_teams";
export const ACTIVE_KEY = "mesh_active_team";
export const EVENTS_KEY = "mesh_calendar_events";
export const DEMO_STORAGE_KEY = "mesh_demo_mode";

const NICKNAME_PREFIX = "mesh_nickname";

export const getNicknameStorageKey = (email: string) =>
  `${NICKNAME_PREFIX}:${email.toLowerCase()}`;

export const readNickname = (email: string) => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(getNicknameStorageKey(email)) ?? "";
};

export const writeNickname = (email: string, nickname: string) => {
  if (typeof window === "undefined") return;
  const trimmed = nickname.trim();
  const key = getNicknameStorageKey(email);
  if (!trimmed) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, trimmed);
};

export const clearWorkspaceStorage = (email?: string) => {
  if (typeof window === "undefined") return;
  [TEAMS_KEY, ACTIVE_KEY, EVENTS_KEY, DEMO_STORAGE_KEY].forEach((key) => localStorage.removeItem(key));
  if (email) {
    localStorage.removeItem(getNicknameStorageKey(email));
  }
};