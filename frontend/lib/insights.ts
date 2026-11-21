import { createClient } from "./supabase/client";
import { FRONTEND_MOOD_TO_THEME } from "./mood";

export type MoodKey = "sunny" | "cloudy" | "spark" | "wiggles";
export const MOOD_KEYS: MoodKey[] = ["sunny", "cloudy", "spark", "wiggles"];
export type MoodEntry = { mood: MoodKey; at: Date };

// saveMoodEntry stores the mascot key ("sunny" ...). Older rows may hold a mood name ("Happy"), so accept both.
function toMoodKey(raw: unknown): MoodKey | null {
  if (typeof raw !== "string") return null;
  if ((MOOD_KEYS as string[]).includes(raw)) return raw as MoodKey;
  const mapped = (FRONTEND_MOOD_TO_THEME as unknown as Record<string, string | undefined>)[raw];
  return mapped && (MOOD_KEYS as string[]).includes(mapped) ? (mapped as MoodKey) : null;
}

/** Loads ONLY the signed-in user's check-ins from the last 12 months. */
export async function fetchMoodEntries(): Promise<{ ok: true; entries: MoodEntry[] } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again to see your insights." };

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const { data, error } = await supabase
    .from("mood_entries")
    .select("mood, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as { mood: unknown; created_at: string }[];
  const entries = rows.flatMap((row) => {
    const mood = toMoodKey(row.mood);
    const at = new Date(row.created_at);
    return mood && !Number.isNaN(at.getTime()) ? [{ mood, at }] : [];
  });
  return { ok: true, entries };
}

// ---------- statistics (pure, uses the viewer's local time zone) ----------
export type DayCell = { day: number | null; mood: MoodKey | null; count: number };
export type WeekDay = { label: string; mood: MoodKey | null; count: number; isToday: boolean };
export type InsightStats = {
  total: number;
  weekCount: number;
  streak: number;
  week: WeekDay[];
  last30: number;
  breakdown: { mood: MoodKey; count: number; percent: number }[];
  month: { label: string; cells: DayCell[] };
};

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The mood that appeared most on a day; ties go to the most recent one. */
function dominant(moods: MoodKey[]): MoodKey {
  const counts: Record<string, number> = {};
  moods.forEach((m) => { counts[m] = (counts[m] ?? 0) + 1; });
  let best = moods[0];
  moods.forEach((m) => { if (counts[m] >= counts[best]) best = m; });
  return best;
}

export function computeInsights(entries: MoodEntry[], monthOffset = 0, now = new Date()): InsightStats {
  const sorted = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());
  const byDay = new Map<string, MoodKey[]>();
  sorted.forEach((e) => {
    const k = dayKey(e.at);
    byDay.set(k, [...(byDay.get(k) ?? []), e.mood]);
  });
  const info = (d: Date) => {
    const list = byDay.get(dayKey(d));
    return { mood: list ? dominant(list) : null, count: list?.length ?? 0 };
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Current streak: consecutive days with a check-in. Today not checked in yet doesn't break it.
  let cursor = byDay.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (byDay.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  // This week, Monday to Sunday
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const week: WeekDay[] = "MTWTFSS".split("").map((label, i) => {
    const d = addDays(monday, i);
    return { label, ...info(d), isToday: dayKey(d) === dayKey(today) };
  });
  const weekCount = week.reduce((sum, d) => sum + d.count, 0);

  // Mood breakdown over the last 30 days
  const from30 = addDays(today, -29);
  const recent = sorted.filter((e) => e.at >= from30);
  const breakdown = MOOD_KEYS.map((mood) => {
    const count = recent.filter((e) => e.mood === mood).length;
    return { mood, count, percent: recent.length ? Math.round((count / recent.length) * 100) : 0 };
  });

  // Calendar month (Monday first)
  const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: DayCell[] = Array.from({ length: (first.getDay() + 6) % 7 }, () => ({ day: null, mood: null, count: 0 }));
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, ...info(new Date(first.getFullYear(), first.getMonth(), day)) });
  }

  return {
    total: sorted.length,
    weekCount,
    streak,
    week,
    last30: recent.length,
    breakdown,
    month: { label: first.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), cells },
  };
}