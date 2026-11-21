import { createClient } from "./supabase/client";

export type CheckInTime = "morning" | "afternoon" | "evening";

export type Preferences = {
  cameraAccess: boolean; // camera activities and the check-in camera
  autoSuggest: boolean;  // open check-ins with the camera suggestion (off = mood picker first)
  askNote: boolean;      // show the note box in the manual mood picker
  movement: boolean;     // prefer movement activities in recommendations
  quiet: boolean;        // prefer calm activities in recommendations
  privateMode: boolean;
  checkInTime: CheckInTime;
  nickname: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  cameraAccess: true,
  autoSuggest: true,
  askNote: true,
  movement: true,
  quiet: true,
  privateMode: true,
  checkInTime: "morning",
  nickname: "",
};

const TIMES: CheckInTime[] = ["morning", "afternoon", "evening"];

/** Reads whatever is stored in user_metadata.preferences, falling back to defaults for anything missing or invalid. */
export function readPreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bool = (k: keyof Preferences) =>
    typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_PREFERENCES[k] as boolean);
  return {
    cameraAccess: bool("cameraAccess"),
    autoSuggest: bool("autoSuggest"),
    askNote: bool("askNote"),
    movement: bool("movement"),
    quiet: bool("quiet"),
    privateMode: bool("privateMode"),
    checkInTime: TIMES.includes(r.checkInTime as CheckInTime) ? (r.checkInTime as CheckInTime) : DEFAULT_PREFERENCES.checkInTime,
    nickname: typeof r.nickname === "string" ? r.nickname.slice(0, 30) : "",
  };
}

/**
 * Saves the display name and/or preferences to the signed-in user's account (Supabase user_metadata),
 * so they persist across sessions and devices. Preferences are merged with what is already stored.
 */
export async function saveProfile(patch: {
  fullName?: string;
  preferences?: Partial<Preferences>;
}): Promise<{ ok: true; fullName: string; preferences: Preferences } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const meta = (user.user_metadata ?? {}) as { full_name?: string; preferences?: unknown };
  const stored = meta.preferences && typeof meta.preferences === "object" ? meta.preferences : {};
  const preferences = readPreferences({ ...stored, ...patch.preferences });
  const newName = patch.fullName?.trim();

  const { error } = await supabase.auth.updateUser({
    data: { ...(newName ? { full_name: newName } : {}), preferences },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, fullName: newName || meta.full_name || "", preferences };
}