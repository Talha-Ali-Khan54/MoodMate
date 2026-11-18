"use client";

type Mood = "sunny" | "cloudy" | "spark" | "wiggles";

const COLORS: Record<Mood, string> = {
  sunny: "#FFD83D",
  cloudy: "#75C9F5",
  spark: "#FF765E",
  wiggles: "#B991E8",
};

export function AuthMascot({
  type = "sunny",
  size = 160,
  mood = "excited",
}: {
  type?: Mood;
  size?: number;
  mood?: "excited" | "peaceful" | "calm" | "relaxed";
}) {
  const face = {
    sunny: { eyeY: 62, mouth: mood === "excited" ? "M64 82 Q80 101 96 82" : "M66 84 Q80 96 94 84" },
    cloudy: { eyeY: 68, mouth: mood === "peaceful" ? "M69 89 Q80 95 91 89" : "M70 92 Q80 84 90 92" },
    spark: { eyeY: 68, mouth: mood === "relaxed" ? "M68 89 Q80 97 92 89" : "M69 92 Q80 86 91 92" },
    wiggles: { eyeY: 66, mouth: mood === "calm" ? "M69 89 Q80 96 91 89" : "M74 91 Q80 86 86 91" },
  }[type];
  const fill = COLORS[type];

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
    <svg style={{ width: size, height: size }} viewBox="0 0 160 160" role="img" aria-label={`${type} mascot`}>
      <g>
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