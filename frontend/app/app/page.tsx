"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentUser, signOut, saveMoodEntry } from "@/lib/auth";
import { CameraPanel } from "@/components/CameraPanel";
import { CloudCatcher } from "@/components/CloudCatcher/CloudCatcher";
import { MemeStudio } from "@/components/MemeStudio/MemeStudio";
import { BubbleBurst } from "@/components/BubbleBurst/BubbleBurst";
import { MoveMatch } from "@/components/MoveMatch/MoveMatch";
import { AirPainter } from "@/components/AirPainter/AirPainter";
import { fetchMoodEntries, computeInsights, type MoodEntry, type MoodKey } from "@/lib/insights";
import {
  DEFAULT_PREFERENCES,
  readPreferences,
  saveProfile,
  type Preferences,
  type CheckInTime,
} from "@/lib/settings";
import {
  type HybridMoodResult,
  FRONTEND_MOOD_TO_THEME,
} from "@/lib/mood";
import {
  getRecommendedActivity,
  type SupportedMood,
} from "@/lib/recommendations";

type Page =
  | "home" | "checkin" | "results" | "activities"
  | "activity" | "insights" | "profile" | "settings";
type Mood = "sunny" | "cloudy" | "spark" | "wiggles";

const moodData = {
  sunny: { name: "Sunny", mood: "Happy", color: "#FFD83D", soft: "#FFF0A6", note: "Bright, cheerful and full of energy." },
  cloudy: { name: "Cloudy", mood: "Sad", color: "#75C9F5", soft: "#DDF3FF", note: "A little low, tender or reflective." },
  spark: { name: "Spark", mood: "Frustrated", color: "#FF765E", soft: "#FFE0D9", note: "Tense, bothered or ready for change." },
  wiggles: { name: "Wiggles", mood: "Overwhelmed", color: "#B991E8", soft: "#EDE0FA", note: "A lot is happening all at once." },
} as const;

const resultCopy = {
  sunny: { title: "Your sunshine is showing!", text: "Let’s channel that bright energy into something that feels good." },
  cloudy: { title: "It’s okay to have a cloudy day.", text: "Every feeling belongs. Let’s find something small that might help." },
  spark: { title: "That spark has something to say.", text: "Let’s give that energy somewhere kind and useful to go." },
  wiggles: { title: "One little thing at a time.", text: "You don’t need to untangle everything right now. Let’s make a little space." },
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 10.8 12 3l9 7.8" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
    check: <><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="m8 12 2.5 2.5L16.5 8" /></>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.2 3.3-6.3 8-6.3s7.3 2.1 8 6.3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    play: <path d="m9 7 8 5-8 5V7Z" />,
    pause: <><path d="M9 7v10M15 7v10" /></>,
    restart: <><path d="M4 11a8 8 0 1 1 2.3 6" /><path d="M4 5v6h6" /></>,
    camera: <><path d="M4 7h3l2-3h6l2 3h3v12H4V7Z" /><circle cx="12" cy="13" r="4" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Mascot({ type, size = 150, mood = "default", className = "" }: { type: Mood; size?: number; mood?: string; className?: string }) {
  const face = {
    sunny: { eyeY: 62, mouth: mood === "excited" ? "M64 82 Q80 101 96 82" : "M66 84 Q80 96 94 84" },
    cloudy: { eyeY: 68, mouth: mood === "peaceful" ? "M69 89 Q80 95 91 89" : "M70 92 Q80 84 90 92" },
    spark: { eyeY: 68, mouth: mood === "relaxed" ? "M68 89 Q80 97 92 89" : "M69 92 Q80 86 91 92" },
    wiggles: { eyeY: 66, mouth: mood === "calm" ? "M69 89 Q80 96 91 89" : "M74 91 Q80 86 86 91" },
  }[type];
  const fill = moodData[type].color;
  const body = type === "sunny" ? (
    <><g stroke={fill} strokeWidth="9" strokeLinecap="round"><path d="M80 18V8M80 142v10M18 80H8M142 80h10M36 36l-8-8M124 36l8-8M36 124l-8 8M124 124l8 8" /></g><circle cx="80" cy="80" r="52" fill={fill} /></>
  ) : type === "cloudy" ? (
    <path d="M38 112c-17 0-26-11-24-26 1-12 11-21 23-22-1-20 13-34 31-32 11-13 36-7 39 11 18-2 31 9 31 25 13 4 20 15 17 28-3 11-12 16-26 16H38Z" fill={fill} />
  ) : type === "spark" ? (
    <path d="m80 20 13 17 20-11 3 22 23-1-8 21 20 10-17 15 13 19-22 5 2 23-21-8-10 20-16-17-17 16-10-21-22 7 3-23-22-6 14-18L8 75l21-9-7-22 23 2 4-22 20 12 11-16Z" fill={fill} />
  ) : (
    <path d="M30 55C38 31 61 22 79 34c18-18 48-7 48 17 22 6 27 34 10 47 10 24-11 43-33 34-16 21-44 15-49-8-25 5-39-19-25-37-13-9-11-27 0-32Z" fill={fill} />
  );
  return (
    <svg className={`mascot ${className}`} style={{ width: size, height: size }} viewBox="0 0 160 160" role="img" aria-label={`${moodData[type].name} mascot`}>
      <g className="mascot-body">
        <path d="M52 116q-13 11-19 4c-4-5 3-11 14-12M108 116q13 11 19 4c4-5-3-11-14-12" fill="none" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
        {body}
        {type === "spark" && <><path d="m56 55 17 7" stroke="#20213F" strokeWidth="4" strokeLinecap="round" /><path d="m104 55-17 7" stroke="#20213F" strokeWidth="4" strokeLinecap="round" /></>}
        {type === "cloudy" && <><path d="m56 59 15 2" stroke="#20213F" strokeWidth="3.5" strokeLinecap="round" /><path d="m104 59-15 2" stroke="#20213F" strokeWidth="3.5" strokeLinecap="round" /></>}
        <ellipse cx="62" cy={face.eyeY} rx={type === "wiggles" ? 8 : 7} ry={type === "wiggles" ? 11 : 9} fill="#fff" />
        <ellipse cx="98" cy={face.eyeY} rx={type === "wiggles" ? 8 : 7} ry={type === "wiggles" ? 11 : 9} fill="#fff" />
        <circle cx="63" cy={face.eyeY + 1} r="4" fill="#20213F" />
        <circle cx="97" cy={face.eyeY + 1} r="4" fill="#20213F" />
        <circle cx="64.5" cy={face.eyeY - 1} r="1.2" fill="#fff" />
        <circle cx="98.5" cy={face.eyeY - 1} r="1.2" fill="#fff" />
        <path d={face.mouth} fill="none" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
        {type === "sunny" && <><circle cx="48" cy="82" r="5" fill="#F7A858" opacity=".65" /><circle cx="112" cy="82" r="5" fill="#F7A858" opacity=".65" /></>}
        <path d="M62 128q-2 12-10 14M98 128q2 12 10 14" fill="none" stroke="#20213F" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const nav = [
  { page: "home", label: "Home", icon: "home" },
  { page: "checkin", label: "Mood Check-in", icon: "check" },
  { page: "activities", label: "Activities", icon: "bolt" },
  { page: "insights", label: "Mood Insights", icon: "chart" },
  { page: "profile", label: "My Profile", icon: "user" },
  { page: "settings", label: "Settings", icon: "settings" },
] as const;

const activities = [
  { id: "cloud-catcher", title: "Cloud Catcher", desc: "Guide your cloud with gentle head movements to catch stars and brighten the gloomy sky.", time: "2 min", cat: "Relaxing Journey", color: "#75C9F5", art: "cloud" },
  { id: "meme", title: "Meme Recreation", desc: "Channel your positive, joyful energy into recreating iconic hilarious memes.", time: "3 min", cat: "Camera Challenge", color: "#FFD83D", art: "camera" },
  { id: "bubble-burst", title: "Bubble Burst", desc: "Pop the pressure away with satisfying, explosive stress bubbles.", time: "2 min", cat: "Stress Release", color: "#FF765E", art: "focus" },
  { id: "move-match", title: "Move & Match", desc: "Quick, fun movement resets to bring energy, focus, and alignment.", time: "3 min", cat: "Move Your Body", color: "#A8E6C3", art: "move" },
  { id: "air-painter", title: "Air Painter", desc: "Channel your positive energy into glowing neon artwork.", time: "4 min", cat: "Creative Flow", color: "#FFD83D", art: "draw" },
  { id: "box-breathing", title: "Box breathing", desc: "Find your rhythm with a gentle guided breath.", time: "2 min", cat: "Relax & Breathe", color: "#75C9F5", art: "breathe" },
  { id: "doodle", title: "Tiny doodle", desc: "Let your pencil wander. There is no wrong result.", time: "5 min", cat: "Get Creative", color: "#B991E8", art: "draw" },
] as const;

function ActivityArt({ type, color }: { type: string; color: string }) {
  return (
    <div className="activity-art" style={{ backgroundColor: color }}>
      <svg viewBox="0 0 100 80" aria-hidden="true">
        {type === "cloud" && (
          <>
            <path
              d="M30 52c-7 0-12-5-11-12 1-6 5-10 11-10 0-10 6-16 15-15 5-6 17-3 19 5 9-1 15 4 15 12 6 2 9 7 8 13-2 5-6 7-13 7H30Z"
              fill="#fff"
            />
            <circle cx="43" cy="42" r="2.5" fill="#20213F" />
            <circle cx="57" cy="42" r="2.5" fill="#20213F" />
            <path d="M47 47q3 3 6 0" fill="none" stroke="#20213F" strokeWidth="2" strokeLinecap="round" />
            <path d="M72 23l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#FFF0A6" stroke="#20213F" strokeWidth="1.5" />
          </>
        )}
        {type === "breathe" && <><circle cx="50" cy="39" r="24" fill="#fff" opacity=".8" /><circle cx="50" cy="39" r="14" fill="none" stroke="#20213F" strokeWidth="3" /><path d="M50 14v10M25 39h10M65 39h10M50 54v10" stroke="#20213F" strokeWidth="3" strokeLinecap="round" /></>}
        {type === "move" && <><path d="M47 15c9 1 13 8 10 15l14 10-6 7-15-9-7 14 15 12-6 7-21-14 9-23-13 5-4-8 24-16Z" fill="#fff" /><circle cx="53" cy="12" r="8" fill="#20213F" /></>}
        {type === "draw" && <><path d="M18 59 66 11l13 13-48 48-17 4 4-17Z" fill="#fff" /><path d="m62 15 13 13M18 59l13 13" stroke="#20213F" strokeWidth="3" /><path d="M69 57q13-8 17 3-8 2-3 12" fill="none" stroke="#20213F" strokeWidth="3" strokeLinecap="round" /></>}
        {type === "focus" && <><path d="M50 12 61 31l22 5-15 17 2 22-20-9-20 9 2-22-15-17 22-5 11-19Z" fill="#fff" /><circle cx="50" cy="44" r="8" fill={color} stroke="#20213F" strokeWidth="3" /></>}
        {type === "heart" && <path d="M50 70S15 51 17 30c2-18 26-19 33-4 7-15 31-14 33 4 2 21-33 40-33 40Z" fill="#fff" stroke="#20213F" strokeWidth="3" />}
        {type === "camera" && <><path d="M4 7h3l2-3h6l2 3h3v12H4V7Z" fill="#fff" stroke="#20213F" strokeWidth="3" /><circle cx="12" cy="13" r="4" fill="none" stroke="#20213F" strokeWidth="3" /></>}
      </svg>
    </div>
  );
}

function Sidebar({
  page, go, open, close, displayName, initials,
}: {
  page: Page;
  go: (p: Page) => void;
  open: boolean;
  close: () => void;
  displayName: string;
  initials: string;
}) {
  return (
    <>
      {open && <button className="nav-scrim" onClick={close} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark"><span /><span /></span><span>MoodMate</span></div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.page}
              className={page === item.page || (page === "results" && item.page === "checkin") || (page === "activity" && item.page === "activities") ? "active" : ""}
              onClick={() => { go(item.page); close(); }}
            >
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-profile" onClick={() => { go("profile"); close(); }} style={{ cursor: "pointer" }}>
          <div className="avatar">{initials}</div>
          <div><b>{displayName}</b><span>7 day streak</span></div>
        </div>
      </aside>
    </>
  );
}

type Notice = { id: number; icon: string; title: string; text: string; time: string; go?: Page; unread: boolean };

const initialNotices: Notice[] = [
  { id: 1, icon: "🔥", title: "7 day streak!", text: "A whole week of showing up for yourself. Keep it gentle.", time: "Just now", go: "insights", unread: true },
  { id: 2, icon: "🧠", title: "Time for a check-in", text: "How are you feeling today? It only takes a minute.", time: "9:00 AM", go: "checkin", unread: true },
  { id: 3, icon: "☁️", title: "New: Cloud Catcher", text: "Catch gentle stars with your head movements to brighten cloudy days.", time: "Yesterday", go: "activities", unread: true },
];

function ProfileCrystalPopover({
  close, go, displayName, initials,
}: {
  close: () => void;
  go: (p: Page) => void;
  displayName: string;
  initials: string;
}) {
  const chip = "rounded-full border-2 border-[#20213F] bg-[#FFF0A6] px-2.5 py-1 text-[11px] font-bold text-[#20213F]";
  const action = "flex w-full items-center gap-2 rounded-xl border-2 border-[#20213F] bg-white px-3 py-2 text-left text-xs font-bold text-[#20213F] shadow-[2px_2px_0px_#20213F] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none";
  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" aria-label="Close profile menu" onClick={close} />
      <div className="absolute right-0 top-full z-50 mt-3 w-64 rounded-2xl border-2 border-[#20213F] bg-[#FFFDF8] p-4 font-mono shadow-[5px_5px_0px_#20213F]" role="dialog" aria-label="Profile menu">
        <div className="flex items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-[#20213F] bg-[#B991E8] font-bold text-[#20213F]">{initials}</div>
          <div className="min-w-0">
            <b className="block truncate text-sm text-[#20213F]">{displayName}</b>
            <span className="mt-1 inline-block rounded-full border border-[#20213F] bg-[#FFD83D] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#20213F]">Explorer</span>
          </div>
        </div>
        <div className="my-3 border-t-2 border-dashed border-[#20213F]/30" />
        <div className="flex flex-wrap gap-2">
          <span className={chip}>🔥 7 day streak</span>
          <span className={chip}>✓ 14 check-ins</span>
          <span className={chip}>⚡ 3 activities</span>
        </div>
        <div className="my-3 border-t-2 border-dashed border-[#20213F]/30" />
        <div className="space-y-2">
          <button className={action} onClick={() => { go("profile"); close(); }}><Icon name="user" size={16} /> View profile</button>
          <button className={action} onClick={() => { go("settings"); close(); }}><Icon name="settings" size={16} /> Settings</button>
        </div>
      </div>
    </>
  );
}

function Header({
  title, onMenu, go, displayName, initials,
}: {
  title: string;
  onMenu: () => void;
  go: (p: Page) => void;
  displayName: string;
  initials: string;
}) {
  const [panel, setPanel] = useState<"none" | "notices" | "profile">("none");
  const [notices, setNotices] = useState<Notice[]>(initialNotices);
  const unread = notices.filter((n) => n.unread).length;

  useEffect(() => {
    if (panel === "none") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel("none"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const toggle = (p: "notices" | "profile") => setPanel((cur) => (cur === p ? "none" : p));
  const markAllRead = () => setNotices((list) => list.map((n) => ({ ...n, unread: false })));
  const openNotice = (n: Notice) => {
    setNotices((list) => list.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
    setPanel("none");
    if (n.go) go(n.go);
  };

  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Open navigation"><Icon name="menu" /></button>
      <div><span className="eyebrow">TODAY</span><h2>{title}</h2></div>
      <div className="top-actions">
        <div className="relative">
          <button
            className="icon-button notification"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            aria-expanded={panel === "notices"}
            onClick={() => toggle("notices")}
          >
            <Icon name="bell" />{unread > 0 && <i />}
          </button>
          {panel === "notices" && (
            <>
              <button className="fixed inset-0 z-40 cursor-default" aria-label="Close notifications" onClick={() => setPanel("none")} />
              <div className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-2 border-[#20213F] bg-[#FFFDF8] p-3 shadow-[5px_5px_0px_#20213F]" role="dialog" aria-label="Notifications">
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                  <b className="font-fredoka text-lg text-[#20213F]">Notifications</b>
                  <div className="flex gap-3 text-xs font-bold text-[#20213F]/70">
                    <button className="underline hover:text-[#20213F]" onClick={markAllRead}>Mark all read</button>
                    <button className="underline hover:text-[#20213F]" onClick={() => setNotices([])}>Clear</button>
                  </div>
                </div>
                {notices.length === 0 ? (
                  <p className="rounded-xl border-2 border-dashed border-[#20213F]/30 px-3 py-6 text-center text-sm font-bold text-[#20213F]/60">You’re all caught up ✦</p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto">
                    {notices.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => openNotice(n)}
                          className={`flex w-full items-start gap-3 rounded-xl border-2 border-[#20213F] p-3 text-left transition-all hover:translate-x-0.5 hover:translate-y-0.5 ${n.unread ? "bg-[#FFF0A6]" : "bg-white"}`}
                        >
                          <span className="text-xl leading-none" aria-hidden="true">{n.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <b className="text-sm text-[#20213F]">{n.title}</b>
                              <small className="shrink-0 text-[11px] text-[#20213F]/60">{n.time}</small>
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-[#20213F]/75">{n.text}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <div
            className="avatar"
            role="button"
            tabIndex={0}
            aria-label="Open profile menu"
            aria-expanded={panel === "profile"}
            onClick={() => toggle("profile")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle("profile"); }}
            style={{ cursor: "pointer" }}
          >
            {initials}
          </div>
          {panel === "profile" && (
            <ProfileCrystalPopover close={() => setPanel("none")} go={go} displayName={displayName} initials={initials} />
          )}
        </div>
      </div>
    </header>
  );
}

function Home({
  go, displayName, setActivity,
}: {
  go: (p: Page) => void;
  displayName: string;
  setActivity: (id: string) => void;
}) {
  const firstName = displayName.split(" ")[0];
  return (
    <div className="page home-page">
      <section className="hero">
        <div className="hero-scribble">How are we, really?</div>
        <div className="hero-copy">
          <span className="pill white">A SMALL PAUSE FOR YOUR BRAIN</span>
          <h1>Hi {firstName}, what’s happening <em>inside</em> your head?</h1>
          <p>A little check-in can change your day.</p>
          <button className="primary" onClick={() => go("checkin")}><span>Check in with yourself</span> <Icon name="arrow" /></button>
          <small>All feelings welcome. No fixing required.</small>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <span className="sparkle s1">✦</span><span className="sparkle s2">✦</span>
          <Mascot type="sunny" size={245} mood="excited" />
        </div>
      </section>
      <section className="mood-stage">
        <div className="mood-stage-copy">
          <span className="eyebrow">MEET YOUR INNER WEATHER</span>
          <h2>Every version of you<br />gets a seat.</h2>
          <p>Tap into whatever is showing up — bright, heavy, fiery, or all over the place.</p>
          <button className="text-button" onClick={() => go("checkin")}>Who are you today? <Icon name="arrow" size={17} /></button>
        </div>
        <div className="mood-cast">
          {(["sunny", "cloudy", "spark", "wiggles"] as Mood[]).map((m, i) => (
            <button key={m} className={`cast-member cast-${i}`} onClick={() => go("checkin")}>
              <Mascot type={m} size={i === 1 ? 185 : 165} /><span>{moodData[m].name}</span><small>{moodData[m].mood}</small>
            </button>
          ))}
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="card today-card">
          <div className="card-heading">
            <div><span className="eyebrow">TODAY’S MOOD</span><h3>A little cloudy</h3></div>
            <button className="text-button" onClick={() => go("insights")}>View insights <Icon name="arrow" size={16} /></button>
          </div>
          <div className="today-content">
            <Mascot type="cloudy" size={122} />
            <div>
              <p>You checked in recently</p>
              <div className="mood-tag">Thoughtful & low-energy</div>
              <p className="soft-copy">Be extra gentle with yourself today.</p>
            </div>
          </div>
        </section>
        <section className="card win-card">
          <span className="eyebrow">YOUR DAILY LITTLE WIN</span>
          <div className="win-icon">✦</div>
          <h3>You showed up for yourself</h3>
          <p>That’s worth celebrating, no matter how small it feels.</p>
          <div className="streak">
            <b>7</b><span>day check-in<br />streak</span>
            <div className="streak-dots">{[1,2,3,4,5,6,7].map((i) => <i key={i} />)}</div>
          </div>
        </section>
      </div>
      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">ONE TINY THING</span><h2>Turn the feeling<br />into something.</h2></div>
          <button className="secondary" onClick={() => go("activities")}>See all activities</button>
        </div>
        <div className="recommend-grid">
          {activities.slice(0, 3).map((a, i) => (
            <ActivityCard
              key={a.title}
              activity={a}
              onStart={() => { setActivity(a.id); go("activity"); }}
              featured={i === 0}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MoodCheckin({
  select,
  selected,
  confirm,
  hybridResult,
  setHybridResult,
  confirmedMood,
  setConfirmedMood,
  cameraAccess,
  autoSuggest,
  askNote,
}: {
  select: (m: Mood) => void;
  selected: Mood | null;
  confirm: (mood: SupportedMood, note: string) => void;
  hybridResult: HybridMoodResult | null;
  setHybridResult: (r: HybridMoodResult | null) => void;
  confirmedMood: SupportedMood | null;
  setConfirmedMood: (m: SupportedMood) => void;
  cameraAccess: boolean;
  autoSuggest: boolean;
  askNote: boolean;
}) {
  const [note, setNote] = useState("");
  const [manualMode, setManualMode] = useState(!autoSuggest || !cameraAccess);

  const supportedMoods: SupportedMood[] = [
    "Sad",
    "Overwhelmed",
    "Happy",
    "Neutral",
    "Lazy",
    "Angry",
    "Frustrated",
  ];

  function handleHybridPrediction(result: HybridMoodResult) {
    setHybridResult(result);

    let initialChoice: SupportedMood = "Neutral";
    if (result.frontendMood === "Sad") initialChoice = "Sad";
    else if (result.frontendMood === "Overwhelmed") initialChoice = "Overwhelmed";
    else if (result.frontendMood === "Happy") initialChoice = "Happy";
    else if (result.frontendMood === "Lazy") initialChoice = "Lazy";
    else if (result.frontendMood === "Angry") initialChoice = "Angry";
    else if (result.frontendMood === "Frustrated") initialChoice = "Frustrated";
    else initialChoice = "Neutral";

    setConfirmedMood(initialChoice);
    select(FRONTEND_MOOD_TO_THEME[result.frontendMood] || "cloudy");
  }

  return (
    <div className="page checkin-page">
      <section className="ai-intro">
        <div>
          <span className="pill lavender">AI EXPRESSION CHECK-IN</span>
          <h1>Let’s see what’s<br /><em>going on.</em></h1>
        </div>
        <div className="ai-intro-note"><span>01</span><p>Face the camera for MediaPipe landmark reading and Random Forest prediction.</p></div>
      </section>
      <section className="ai-studio">
        {cameraAccess ? (
          <CameraPanel
            onPrediction={handleHybridPrediction}
            onError={() => setManualMode(true)}
          />
        ) : (
          <div className="rounded-3xl border-2 border-[#20213F] bg-[#FFFDF8] p-8 text-center shadow-[6px_7px_0px_#20213F]">
            <Icon name="camera" size={36} />
            <h2 className="mt-3 font-fredoka text-2xl font-extrabold text-[#20213F]">Camera is turned off</h2>
            <p className="mt-2 text-sm text-[#20213F]/75">You can still check in by choosing your mood. Turn the camera back on in Settings any time.</p>
          </div>
        )}
        <aside className="ai-guide">
          <div className="guide-mascot">
            <Mascot type={selected || "wiggles"} size={selected ? 190 : 150} mood={selected ? "excited" : "calm"} />
            <span className="guide-scribble">I’m right here!</span>
          </div>
          {hybridResult ? (
            <div className="prediction-panel">
              <span className="eyebrow">EXPRESSION FOUND</span>
              <h2>You’re looking {hybridResult.frontendMood.toLowerCase()}!</h2>
              <p>This is only a guess. It doesn’t define what you feel.</p>
              <h3>Does this match how you’re feeling?</h3>
              <button
                className="answer-yes chosen"
                onClick={() => confirm(confirmedMood || "Neutral", "")}
              >
                <Icon name="check" /> Yes, let's continue
              </button>
              <button
                className="manual-link"
                style={{ marginTop: 10, display: "block" }}
                onClick={() => setManualMode(true)}
              >
                Not quite? Pick your mood manually
              </button>
            </div>
          ) : selected ? (
            <div className="prediction-panel">
              <span className="eyebrow">MOOD SELECTED</span>
              <h2>{moodData[selected].name} ({moodData[selected].mood})</h2>
              <h3>Ready to continue?</h3>
              <button className="answer-yes chosen" onClick={() => confirm(moodData[selected].mood as SupportedMood, "")}>
                <Icon name="check" /> Yes, let's continue
              </button>
            </div>
          ) : (
            <div className="analysis-panel">
              <span className="eyebrow">HOW IT WORKS</span>
              <h2>Your face. Your say.</h2>
              <p>MoodMate looks for visible facial patterns, then offers a suggestion for you to confirm or change.</p>
              <div className="privacy-stamp">
                <Icon name="shield" size={19} />
                <span><b>Designed for privacy</b>Your video stays on this device and is never saved.</span>
              </div>
              <button className="manual-link" onClick={() => setManualMode(true)}>No camera? Check in manually</button>
            </div>
          )}
        </aside>
      </section>
      {manualMode && (
        <section className="manual-confirm">
          <div className="manual-heading">
            <span className="eyebrow">YOUR CALL</span>
            <h2>What’s actually going on inside?</h2>
            <p>The models suggest. You’re the expert on you.</p>
          </div>
          <div className="manual-moods">
            {supportedMoods.map((m) => {
              const themeKey = FRONTEND_MOOD_TO_THEME[m] || "cloudy";
              return (
                <button
                  key={m}
                  className={confirmedMood === m ? "selected" : ""}
                  style={{ "--mood": moodData[themeKey].color } as React.CSSProperties}
                  onClick={() => {
                    setConfirmedMood(m);
                    select(themeKey);
                  }}
                >
                  <Mascot type={themeKey} size={120} />
                  <span>{m}</span>
                  <i><Icon name="check" size={16} /></i>
                </button>
              );
            })}
          </div>
          {askNote && (
            <div className="context-note">
              <label htmlFor="mood-note"><span>Want to tell us a little more?</span><small>Optional · just for you</small></label>
              <textarea id="mood-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={180} placeholder="What’s been on your mind?" />
              <span>{note.length}/180</span>
            </div>
          )}
          <div className="mood-finish">
            <div><span className="eyebrow">UP NEXT</span><h3>Alright, let’s find something that might help.</h3></div>
            <button className="primary" disabled={!confirmedMood} onClick={() => confirm(confirmedMood || "Neutral", note)}>
              Continue with {confirmedMood || "my mood"} <Icon name="arrow" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Results({
  mood,
  confirmedMood,
  go,
  setActivity,
  onStartActivity,
  cameraAccess,
  movement,
  quiet,
}: {
  mood: Mood;
  confirmedMood?: SupportedMood;
  go: (p: Page) => void;
  setActivity?: (id: string) => void;
  onStartActivity?: (id: string, title: string) => void;
  cameraAccess: boolean;
  movement: boolean;
  quiet: boolean;
}) {
  const data = resultCopy[mood];
  const recommendedMeta = getRecommendedActivity(confirmedMood || "Sad");

  const featuredAct = activities.find((a) => a.id === recommendedMeta.id) || activities[0];

  const CAMERA_IDS = ["meme", "bubble-burst", "move-match", "cloud-catcher", "air-painter"];
  const MOVEMENT_IDS = ["move-match", "bubble-burst"];
  const QUIET_IDS = ["box-breathing", "doodle"];
  const score = (id: string) =>
    (movement && MOVEMENT_IDS.includes(id) ? 1 : 0) + (quiet && QUIET_IDS.includes(id) ? 1 : 0);
  const otherActs = activities
    .filter((a) => a.id !== featuredAct.id && (cameraAccess || !CAMERA_IDS.includes(a.id)))
    .sort((a, b) => score(b.id) - score(a.id))
    .slice(0, 2);

  const displayed = [featuredAct, ...otherActs];

  return (
    <div className="page results-page">
      <section className="result-hero" style={{ "--mood": moodData[mood].color, "--soft": moodData[mood].soft } as React.CSSProperties}>
        <div className="result-art"><Mascot type={mood} size={225} mood={mood === "cloudy" ? "peaceful" : "relaxed"} /></div>
        <div>
          <span className="pill white">CHECK-IN COMPLETE</span>
          <h1>{data.title}</h1>
          <p>{data.text}</p>
          <div className="result-feeling">
            <i style={{ background: moodData[mood].color }} />
            {confirmedMood || moodData[mood].mood} · just now
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">RECOMMENDED FOR YOU</span>
          <h2>Let’s turn this feeling<br />into something.</h2>
          <p>Recommended based on your confirmed mood: <b>{confirmedMood || "Neutral"}</b></p>
        </div>
      </div>
      <div className="recommend-grid">
        {displayed.map((a, i) => (
          <ActivityCard
            key={a.title}
            activity={a}
            onStart={() => {
              if (
                a.id === "cloud-catcher" ||
                a.id === "meme" ||
                a.id === "bubble-burst" ||
                a.id === "move-match" ||
                a.id === "air-painter"
              ) {
                setActivity?.(a.id);
                go("activity");
              } else if (onStartActivity) {
                onStartActivity(a.id, a.title);
              } else {
                setActivity?.(a.id);
                go("activity");
              }
            }}
            featured={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ activity, onStart, featured = false }: { activity: typeof activities[number]; onStart: () => void; featured?: boolean }) {
  return (
    <article className={`activity-card ${featured ? "featured" : ""}`}>
      <ActivityArt type={activity.art} color={activity.color} />
      <div className="activity-card-body">
        <span className="category">{activity.cat}</span>
        <h3>{activity.title}</h3>
        <p>{activity.desc}</p>
        <div className="activity-meta">
          <span><Icon name="clock" size={16} />{activity.time}</span>
          <button onClick={onStart}>{featured ? "Start activity" : "Start"} <Icon name="arrow" size={16} /></button>
        </div>
      </div>
    </article>
  );
}

function Activities({ go, setActivity }: { go: (p: Page) => void; setActivity: (id: string) => void }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Stress Release", "Camera Challenge", "Relax & Breathe", "Move Your Body", "Get Creative", "Brain Boost"];
  const shown = filter === "All" ? activities : activities.filter((a) => a.cat === filter);

  return (
    <div className="page activities-page">
      <section className="page-intro illustrated">
        <div>
          <span className="pill yellow">ACTIVITY LIBRARY</span>
          <h1>Little things that<br />make a difference.</h1>
          <p>Quick, playful ways to meet yourself where you are.</p>
        </div>
        <div className="mini-friends"><Mascot type="wiggles" size={130} mood="calm" /><Mascot type="spark" size={110} mood="relaxed" /></div>
      </section>
      <div className="filter-row">
        {filters.map((f) => <button className={filter === f ? "active" : ""} onClick={() => setFilter(f)} key={f}>{f}</button>)}
      </div>
      <div className="activity-library">
        {shown.map((a) => (
          <ActivityCard
            key={a.title}
            activity={a}
            onStart={() => { setActivity(a.id); go("activity"); }}
          />
        ))}
      </div>
    </div>
  );
}

function BreathingActivity({ go }: { go: (p: Page) => void }) {
  const phases = [{ name: "Inhale", seconds: 4 }, { name: "Hold", seconds: 4 }, { name: "Exhale", seconds: 6 }];
  const [running, setRunning] = useState(false), [phase, setPhase] = useState(0), [remaining, setRemaining] = useState(4), [round, setRound] = useState(1), [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!running || complete) return;
    const timer = setInterval(() => setRemaining((r) => {
      if (r > 1) return r - 1;
      const next = (phase + 1) % 3;
      if (next === 0) { if (round === 3) { setRunning(false); setComplete(true); return 0; } setRound((x) => x + 1); }
      setPhase(next);
      return phases[next].seconds;
    }), 1000);
    return () => clearInterval(timer);
  }, [running, phase, round, complete]);

  function reset() { setRunning(false); setPhase(0); setRemaining(4); setRound(1); setComplete(false); }

  if (complete) return (
    <div className="page activity-experience">
      <section className="celebration">
        <div className="confetti">✦　•　✦　•　✦</div>
        <Mascot type="sunny" size={220} mood="excited" />
        <span className="pill yellow">YOU DID IT</span>
        <h1>A little more room to breathe.</h1>
        <p>You made two minutes just for yourself. That counts.</p>
        <div>
          <button className="secondary" onClick={reset}><Icon name="restart" /> Do it again</button>
          <button className="primary" onClick={() => go("activities")}>Explore more <Icon name="arrow" /></button>
        </div>
      </section>
    </div>
  );

  return (
    <div className="page activity-experience">
      <button className="back-link" onClick={() => go("activities")}>← Back to activities</button>
      <div className="breathing-layout">
        <section className="breathing-main">
          <span className="pill blue">2-MINUTE RESET</span>
          <h1>Let’s breathe together</h1>
          <p>Follow Cloudy’s rhythm. There’s nowhere else you need to be.</p>
          <div className={`breath-orb phase-${phase} ${running ? "running" : ""}`}>
            <div className="orb-ring r1" /><div className="orb-ring r2" />
            <div className="orb-core"><span>{phases[phase].name}</span><b>{remaining}</b><small>seconds</small></div>
          </div>
          <div className="phase-track">{phases.map((p, i) => <div className={i === phase ? "active" : ""} key={p.name}><i />{p.name}<span>{p.seconds}s</span></div>)}</div>
          <div className="activity-controls">
            <button className="control-main" onClick={() => setRunning(!running)}><Icon name={running ? "pause" : "play"} />{running ? "Pause" : "Begin"}</button>
            <button className="control-small" onClick={reset} aria-label="Restart"><Icon name="restart" /></button>
          </div>
          <div className="round-progress"><span>Round {round} of 3</span><div><i style={{ width: `${(((round - 1) * 3 + phase + 1) / 9) * 100}%` }} /></div></div>
        </section>
        <aside className="breathing-friend">
          <div className={`friend-wrap ${running ? "breathing" : ""}`}><Mascot type="cloudy" size={210} mood="peaceful" /></div>
          <div className="speech">Nice and easy.<br />I’m right here with you.</div>
          <div className="sound-note">Sound is off · No distractions</div>
        </aside>
      </div>
    </div>
  );
}

function DoodleActivity({ go }: { go: (p: Page) => void }) {
  return (
    <div className="page activity-experience">
      <button className="back-link" onClick={() => go("activities")}>← Back to activities</button>
      <div className="breathing-layout">
        <section className="breathing-main">
          <span className="pill purple">CREATIVE PLAY</span>
          <h1>Tiny doodle</h1>
          <p>Let your pencil wander. There is no wrong result.</p>

          <div style={{ border: "2px dashed #B991E8", borderRadius: 20, height: 300, display: "grid", placeItems: "center", margin: "2rem 0", background: "#F8F5FF" }}>
            <p style={{ color: "#B991E8", fontWeight: "bold" }}>Grab a piece of paper and doodle for 5 minutes.</p>
          </div>

          <div style={{ textAlign: "center" }}>
            <button className="primary" onClick={() => go("activities")}>I'm done doodling</button>
          </div>
        </section>
        <aside className="breathing-friend">
          <Mascot type="wiggles" size={210} mood="calm" />
          <div className="speech">No rules here. Just draw!</div>
        </aside>
      </div>
    </div>
  );
}

function WeeklyMood({ days }: { days: { label: string; mood: MoodKey | null; count: number; isToday: boolean }[] }) {
  return (
    <section className="card weekly">
      <div className="card-heading">
        <div><span className="eyebrow">THIS WEEK</span><h3>Your mood rhythm</h3></div>
        <span className="supportive">No right or wrong feelings</span>
      </div>
      <div className="mood-bars">
        {days.map((d, i) => (
          <div key={i} title={d.count ? `${d.count} check-in${d.count === 1 ? "" : "s"}` : "No check-in"}>
            <div className="bar-track">
              <span style={{ height: d.mood ? `${Math.min(100, 45 + d.count * 18)}%` : "6%", background: d.mood ? moodData[d.mood].color : "#E9E3D6" }} />
            </div>
            <small style={d.isToday ? { fontWeight: 800 } : undefined}>{d.label}</small>
          </div>
        ))}
      </div>
      <div className="mood-legend">
        {(["sunny", "cloudy", "spark", "wiggles"] as Mood[]).map((m) => <span key={m}><i style={{ background: moodData[m].color }} />{moodData[m].mood}</span>)}
      </div>
    </section>
  );
}

function Insights({ go }: { go: (p: Page) => void }) {
  const [entries, setEntries] = useState<MoodEntry[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchMoodEntries();
      if (cancelled) return;
      if (result.ok) { setEntries(result.entries); setError(""); }
      else setError(result.error);
    }
    load();
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.removeEventListener("focus", load); };
  }, [reload]);

  if (entries === null) {
    return (
      <div className="page insights-page">
        <section className="page-intro">
          <span className="pill mint">YOUR PATTERNS</span>
          {error ? (
            <>
              <h1>We couldn’t load<br /><em>your insights.</em></h1>
              <p>{error}</p>
              <button className="primary" onClick={() => { setError(""); setReload((n) => n + 1); }}>Try again</button>
            </>
          ) : (
            <h1>Gathering your<br /><em>inner weather…</em></h1>
          )}
        </section>
      </div>
    );
  }

  const s = computeInsights(entries, monthOffset);

  if (s.total === 0) {
    return (
      <div className="page insights-page">
        <section className="page-intro">
          <span className="pill mint">YOUR PATTERNS</span>
          <h1>Nothing here yet,<br /><em>and that’s okay.</em></h1>
          <p>Your patterns will show up here after your first check-in.</p>
          <button className="primary" onClick={() => go("checkin")}>Do your first check-in</button>
        </section>
      </div>
    );
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="page insights-page">
      <section className="page-intro">
        <span className="pill mint">YOUR PATTERNS</span>
        <h1>Your feelings have been<br /><em>doing their thing.</em></h1>
        <p>A curious look at your inner weather — never a scorecard. Mood breakdown covers your last 30 days.</p>
      </section>
      <section className="insight-banner">
        <Mascot type="sunny" size={105} mood="excited" />
        <div>
          <span className="eyebrow">{s.weekCount > 0 ? "A LITTLE CELEBRATION" : "A GENTLE NUDGE"}</span>
          <h2>
            {s.weekCount === 0
              ? "No check-ins yet this week."
              : `You’ve made time for yourself ${s.weekCount === 1 ? "once" : `${s.weekCount} times`} this week!`}
          </h2>
          <p>{s.streak > 0 ? `You’re on a ${s.streak}-day streak.` : "Every check-in is a moment of self-awareness."}</p>
        </div>
        <div className="big-number">{s.weekCount}<span>{s.weekCount === 1 ? "check-in" : "check-ins"}</span></div>
      </section>
      <div className="stat-grid">
        {s.breakdown.map(({ mood, count, percent }) => (
          <div className="emotion-stat" key={mood} style={{ "--mood": moodData[mood].color } as React.CSSProperties}>
            <Mascot type={mood} size={65} />
            <div><span>{moodData[mood].mood}</span><b>{plural(count, "time", "times")}</b></div>
            <small>{percent}%</small>
          </div>
        ))}
      </div>
      <div className="insights-grid">
        <WeeklyMood days={s.week} />
        <section className="card calendar">
          <div className="card-heading">
            <div><span className="eyebrow">{s.month.label.toUpperCase()}</span><h3>Mood calendar</h3></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="round-arrow" aria-label="Previous month" disabled={monthOffset <= -11} onClick={() => setMonthOffset((o) => o - 1)}>‹</button>
              <button className="round-arrow" aria-label="Next month" disabled={monthOffset >= 0} onClick={() => setMonthOffset((o) => o + 1)}>›</button>
            </div>
          </div>
          <div className="calendar-days">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <b key={i}>{d}</b>)}
            {s.month.cells.map((c, i) =>
              c.day === null ? <span key={i} /> : (
                <span key={i} className={c.mood ? "has-mood" : ""} title={c.count ? `${c.count} check-in${c.count === 1 ? "" : "s"}` : undefined}>
                  {c.day}{c.mood && <i style={{ background: moodData[c.mood].color }} />}
                </span>
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileSettings({
  settings = false, go, onSignOut, displayName, initials, prefs, onPrefChange, onSaveProfile, onResetPrefs,
}: {
  settings?: boolean;
  go: (p: Page) => void;
  onSignOut?: () => void;
  displayName: string;
  initials: string;
  prefs: Preferences;
  onPrefChange: (patch: Partial<Preferences>) => void;
  onSaveProfile: (v: { fullName: string; nickname: string; checkInTime: CheckInTime }) => Promise<string | null>;
  onResetPrefs: () => void;
}) {
  const [activeTab, setActiveTab] = useState(settings ? 3 : 0);
  const [fullName, setFullName] = useState(displayName);
  const [nickname, setNickname] = useState(prefs.nickname);
  const [checkInTime, setCheckInTime] = useState<CheckInTime>(prefs.checkInTime);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const tabs = ["Profile information", "Check-in preferences", "Activity preferences", "Privacy & camera", "Account"];
  const greeting = prefs.nickname || displayName.split(" ")[0];

  useEffect(() => {
    setNickname(prefs.nickname);
    setCheckInTime(prefs.checkInTime);
  }, [prefs.nickname, prefs.checkInTime]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const error = await onSaveProfile({ fullName, nickname, checkInTime });
    setSaving(false);
    if (error) {
      setMessage({ ok: false, text: error });
    } else {
      setFullName(fullName.trim());
      setMessage({ ok: true, text: "Saved ✓" });
    }
  }

  return (
    <div className="page profile-page">
      <section className="profile-hero">
        <div className="profile-avatar">{initials}<span>+</span></div>
        <div>
          <span className="eyebrow">{settings ? "YOUR PREFERENCES" : "YOUR PROFILE"}</span>
          <h1>{settings ? "Make MoodMate yours." : `Hi, ${greeting}!`}</h1>
          <p>{settings ? "Choose how your companion supports you." : "You’ve been showing up for yourself since you joined MoodMate."}</p>
        </div>
        <Mascot type={settings ? "wiggles" : "sunny"} size={125} mood="calm" />
      </section>

      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map((x, i) => (
            <button className={activeTab === i ? "active" : ""} key={x} onClick={() => setActiveTab(i)}>
              {x}<span>›</span>
            </button>
          ))}
        </nav>

        <section className="card settings-panel">
          <span className="eyebrow">{tabs[activeTab].toUpperCase()}</span>

          {activeTab === 0 && (
            <>
              <h2>The basics</h2>
              <p className="panel-intro">This helps us make your experience feel more personal.</p>
              <form className="profile-form" onSubmit={submit}>
                <label>Display name
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={50} required />
                </label>
                <label>What should we call you?
                  <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} placeholder={displayName.split(" ")[0]} />
                </label>
                <label>Check-in time
                  <select value={checkInTime} onChange={(e) => setCheckInTime(e.target.value as CheckInTime)}>
                    <option value="morning">Morning · 9:00 AM</option>
                    <option value="afternoon">Afternoon · 2:00 PM</option>
                    <option value="evening">Evening · 7:00 PM</option>
                  </select>
                </label>
                <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                {message && (
                  <p role="status" className={`text-sm font-bold ${message.ok ? "text-[#166534]" : "text-[#FF765E]"}`}>{message.text}</p>
                )}
              </form>
            </>
          )}

          {activeTab === 1 && (
            <>
              <h2>How you check in</h2>
              <p className="panel-intro">Set the default settings for your daily check-ins.</p>
              <div className="toggle-list">
                <Toggle title="Auto-suggest expression" text="Offer the camera expression suggestion first. When off, check-ins open with the mood picker." value={prefs.autoSuggest} set={(v) => onPrefChange({ autoSuggest: v })} />
                <Toggle title="Ask for a note" text="Show a short note box when I pick my mood by hand." value={prefs.askNote} set={(v) => onPrefChange({ askNote: v })} />
              </div>
            </>
          )}

          {activeTab === 2 && (
            <>
              <h2>What feels good?</h2>
              <p className="panel-intro">We'll try to recommend activities that match these preferences.</p>
              <div className="toggle-list">
                <Toggle title="Movement" text="Suggest physical activities like stretching or shaking it out." value={prefs.movement} set={(v) => onPrefChange({ movement: v })} />
                <Toggle title="Quiet time" text="Suggest breathing or doodling instead." value={prefs.quiet} set={(v) => onPrefChange({ quiet: v })} />
              </div>
            </>
          )}

          {activeTab === 3 && (
            <>
              <h2>Your space, your rules</h2>
              <p className="panel-intro">Control what MoodMate can access. Your check-in notes always stay private.</p>
              <div className="toggle-list">
                <Toggle title="Camera access" text="When off, camera activities and expression suggestions are disabled." value={prefs.cameraAccess} set={(v) => onPrefChange({ cameraAccess: v })} />
                <Toggle title="Private mode" text="Hide mood details in notifications and previews." value={prefs.privateMode} set={(v) => onPrefChange({ privateMode: v })} />
                <div className="privacy-box">
                  <Icon name="shield" size={28} />
                  <div><b>Your feelings are yours.</b><p>MoodMate does not sell personal data. Camera processing happens on your device.</p></div>
                </div>
              </div>
            </>
          )}

          {activeTab === 4 && (
            <>
              <h2>Your account</h2>
              <p className="panel-intro">Your settings are saved to your account and follow you to any device.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
                <button
                  className="secondary"
                  onClick={() => {
                    if (window.confirm("Sign out of MoodMate?")) onSignOut?.();
                  }}
                >
                  Sign out
                </button>
                <button
                  className="text-button"
                  style={{ color: "#FF765E", justifyContent: "flex-start" }}
                  onClick={() => {
                    if (window.confirm("Reset all settings to their defaults?")) onResetPrefs();
                  }}
                >
                  Reset app settings
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Toggle({ title, text, value, set }: { title: string; text: string; value: boolean; set: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div><b>{title}</b><p>{text}</p></div>
      <button className={`toggle ${value ? "on" : ""}`} onClick={() => set(!value)} aria-pressed={value} aria-label={title}><i /></button>
    </div>
  );
}

function CameraOff({ go }: { go: (p: Page) => void }) {
  return (
    <div className="page activity-experience">
      <section className="breathing-main" style={{ textAlign: "center" }}>
        <span className="pill pink">CAMERA IS OFF</span>
        <h1>This one needs your camera</h1>
        <p>You turned camera access off in Settings. Turn it back on to play, or pick an activity that doesn’t use the camera.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          <button className="primary" onClick={() => go("settings")}>Open settings</button>
          <button className="secondary" onClick={() => go("activities")}>Choose another activity</button>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [userName, setUserName] = useState("Friend");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [page, setPage] = useState<Page>("home");
  const [selected, setSelected] = useState<Mood | null>(null);
  const [hybridResult, setHybridResult] = useState<HybridMoodResult | null>(null);
  const [confirmedMood, setConfirmedMood] = useState<SupportedMood>("Sad");
  const [activeActivity, setActiveActivity] = useState<string>("meme");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function checkAuth() {
      const u = await currentUser();
      if (!u) {
        router.replace("/login");
        return;
      }
      const meta = (u.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        preferences?: unknown;
      };
      const resolvedName =
        meta.full_name?.trim() ||
        meta.name?.trim() ||
        u.email?.split("@")[0] ||
        "Friend";
      setUserName(resolvedName);
      setPrefs(readPreferences(meta.preferences));
      setAuthChecked(true);
    }
    checkAuth();
  }, [router]);

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Fredoka, sans-serif", fontWeight: 700 }}>
        Loading MoodMate…
      </div>
    );
  }

  const initials =
    userName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "MM";

  const titles: Record<Page, string> = {
    home: "Home",
    checkin: "Mood Check-in",
    results: "Your Check-in",
    activities: "Activities",
    activity: "Guided Activity",
    insights: "Mood Insights",
    profile: "My Profile",
    settings: "Settings",
  };

  function go(p: Page) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirm(moodChoice: SupportedMood, note: string) {
    setConfirmedMood(moodChoice);
    setToast("Check-in saved. Thanks for sharing.");
    const rec = getRecommendedActivity(moodChoice);

    if (
      rec.id === "cloud-catcher" ||
      rec.id === "meme" ||
      rec.id === "bubble-burst" ||
      rec.id === "move-match" ||
      rec.id === "air-painter"
    ) {
      setActiveActivity(rec.id);
      go("activity");
    } else {
      go("results");
    }

    setTimeout(() => setToast(""), 3500);
    const themeKey = FRONTEND_MOOD_TO_THEME[moodChoice as keyof typeof FRONTEND_MOOD_TO_THEME] || "cloudy";
    await saveMoodEntry(themeKey, note);
  }

  function handleStartActivity(id: string, title: string) {
    if (
      id === "cloud-catcher" ||
      id === "meme" ||
      id === "bubble-burst" ||
      id === "move-match" ||
      id === "air-painter"
    ) {
      setActiveActivity(id);
      go("activity");
    } else {
      setToast(`${title} is coming soon! Try Cloud Catcher, Meme Recreation, Bubble Burst, Move & Match or Air Painter.`);
      setTimeout(() => setToast(""), 3500);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function savePrefs(patch: Partial<Preferences>) {
    const before = prefs;
    setPrefs((p) => ({ ...p, ...patch }));
    const result = await saveProfile({ preferences: patch });
    if (!result.ok) {
      setPrefs(before);
      setToast("Couldn’t save that setting. Please try again.");
    } else {
      setToast("Settings saved.");
    }
    setTimeout(() => setToast(""), 3000);
  }

  async function handleSaveProfile(v: { fullName: string; nickname: string; checkInTime: CheckInTime }): Promise<string | null> {
    const name = v.fullName.trim();
    if (!name) return "Please enter a display name.";
    if (name.length > 50) return "Display name can be up to 50 characters.";
    const result = await saveProfile({
      fullName: name,
      preferences: { nickname: v.nickname.trim().slice(0, 30), checkInTime: v.checkInTime },
    });
    if (!result.ok) return result.error;
    setUserName(result.fullName);
    setPrefs(result.preferences);
    return null;
  }

  const renderActivity = () => {
    if (
      !prefs.cameraAccess &&
      ["meme", "bubble-burst", "move-match", "cloud-catcher", "air-painter"].includes(activeActivity)
    ) {
      return <CameraOff go={go} />;
    }

    switch (activeActivity) {
      case "cloud-catcher": return <CloudCatcher go={go} />;
      case "meme": return <MemeStudio go={go} />;
      case "bubble-burst": return <BubbleBurst go={go} />;
      case "move-match": return <MoveMatch go={go} />;
      case "air-painter": return <AirPainter go={go} />;
      case "doodle": return <DoodleActivity go={go} />;
      case "box-breathing":
      default: return <BreathingActivity go={go} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        go={go}
        open={menu}
        close={() => setMenu(false)}
        displayName={userName}
        initials={initials}
      />
      <main>
        <Header
          title={titles[page]}
          onMenu={() => setMenu(true)}
          go={go}
          displayName={userName}
          initials={initials}
        />
        {page === "home" && (
          <Home
            go={go}
            displayName={prefs.nickname || userName}
            setActivity={setActiveActivity}
          />
        )}
        {page === "checkin" && (
          <MoodCheckin
            selected={selected}
            select={setSelected}
            confirm={confirm}
            hybridResult={hybridResult}
            setHybridResult={setHybridResult}
            confirmedMood={confirmedMood}
            setConfirmedMood={setConfirmedMood}
            cameraAccess={prefs.cameraAccess}
            autoSuggest={prefs.autoSuggest}
            askNote={prefs.askNote}
          />
        )}
        {page === "results" && (
          <Results
            mood={selected || "cloudy"}
            confirmedMood={confirmedMood}
            go={go}
            setActivity={setActiveActivity}
            onStartActivity={handleStartActivity}
            cameraAccess={prefs.cameraAccess}
            movement={prefs.movement}
            quiet={prefs.quiet}
          />
        )}
        {page === "activities" && <Activities go={go} setActivity={setActiveActivity} />}
        {page === "activity" && renderActivity()}
        {page === "insights" && <Insights go={go} />}
        {page === "profile" && (
          <ProfileSettings
            go={go}
            onSignOut={handleSignOut}
            displayName={userName}
            initials={initials}
            prefs={prefs}
            onPrefChange={savePrefs}
            onSaveProfile={handleSaveProfile}
            onResetPrefs={() => savePrefs(DEFAULT_PREFERENCES)}
          />
        )}
        {page === "settings" && (
          <ProfileSettings
            settings
            go={go}
            onSignOut={handleSignOut}
            displayName={userName}
            initials={initials}
            prefs={prefs}
            onPrefChange={savePrefs}
            onSaveProfile={handleSaveProfile}
            onResetPrefs={() => savePrefs(DEFAULT_PREFERENCES)}
          />
        )}
      </main>
      {toast && <div className="toast"><Icon name="check" /><span>{toast}</span></div>}
    </div>
  );
}