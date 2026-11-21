const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface CaptionSuggestion {
  top?: string;
  middle?: string;
  bottom?: string;
}

export interface MemeSuggestionsResponse {
  suggestions: Record<string, CaptionSuggestion[]>;
}

// Fallback suggestions in case backend is offline or slow
export const DEFAULT_SUGGESTIONS: Record<string, CaptionSuggestion[]> = {
  "reaction-meme": [
    {
      top: "WHEN SOMEONE SAYS 'JUST RELAX'",
      bottom: "THANK YOU I AM SUDDENLY CURED",
    },
    {
      top: "ME LOOKING AT MY BANK BALANCE",
      bottom: "AFTER PROMISING I WOULD SAVE THIS MONTH",
    },
    {
      top: "WHEN YOU REALISE IT'S ONLY TUESDAY",
      bottom: "AND YOU'VE ALREADY USED 99% OF YOUR ENERGY",
    },
    {
      top: "I AM TOTALLY FINE",
      bottom: "NARRATOR: SHE WAS IN FACT, NOT FINE",
    },
    {
      top: "WHEN YOU OPEN THE EXAM PAPER",
      bottom: "AND QUESTION 1 IS WORTH 40 MARKS",
    },
  ],
  "two-panel": [
    {
      top: "ME PLANNING TO GET MY ENTIRE LIFE TOGETHER TODAY",
      bottom: "ME 12 MINUTES LATER STARING AT THE CEILING",
    },
    {
      top: "BRAIN AT 2 PM: WE ARE GOING TO SLEEP EARLY TONIGHT",
      bottom: "BRAIN AT 3 AM: DO PENGUINS HAVE KNEES?",
    },
    {
      top: "HOW I THINK I HANDLE MILD INCONVENIENCES",
      bottom: "HOW I ACTUALLY HANDLE MILD INCONVENIENCES",
    },
    {
      top: "TELLING MY BESTIE EVERYTHING WILL BE ALRIGHT",
      bottom: "ME DEALING WITH MY OWN MINOR INCONVENIENCE",
    },
  ],
  "choice-meme": [
    {
      top: "FACE RESPONSIBILITIES LIKE AN ADULT",
      middle: "TURN OVERTHINKING INTO DUMB MEMES",
      bottom: "ME CHOOSING THE CHAOS BUTTON EVERY SINGLE TIME",
    },
    {
      top: "GO FOR A 10 MINUTE HEALTHY WALK",
      middle: "STARE AT A SCREEN IN THE DARK",
      bottom: "THE ILLUSION OF FREE CHOICE",
    },
    {
      top: "FINISH WORK EARLY",
      middle: "PROCRASTINATE WITH PASSION",
      bottom: "WHY AM I LIKE THIS?",
    },
  ],
  "expectation-reality": [
    {
      top: "HOW I EXPECTED TODAY WOULD GO",
      bottom: "HOW TODAY ACTUALLY HIT ME",
    },
    {
      top: "ADULTING EXPECTATION: ORGANIZED & HYDRATED",
      bottom: "ADULTING REALITY: CRYING OVER UNPACKED GROCERIES",
    },
    {
      top: "SEMESTER EXPECTATIONS: 4.0 GPA & JOGGING",
      bottom: "SEMESTER REALITY: LIVING ON ICED COFFEE AND PRAYERS",
    },
    {
      top: "EXPECTATION: CALM, COLLECTED AND UNBOTHERED",
      bottom: "REALITY: ONE MINOR INCONVENIENCE CRUSHES MY SPIRIT",
    },
  ],
};

export async function fetchMemeSuggestions(
  templateId?: string
): Promise<CaptionSuggestion[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);

  try {
    const url = templateId
      ? `${API}/api/meme/suggestions?template=${encodeURIComponent(templateId)}`
      : `${API}/api/meme/suggestions`;

    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`API error ${res.status}`);

    const data = await res.json();
    if (templateId && data.suggestions) {
      return data.suggestions as CaptionSuggestion[];
    }
    if (templateId && data.suggestions?.[templateId]) {
      return data.suggestions[templateId] as CaptionSuggestion[];
    }
    return DEFAULT_SUGGESTIONS[templateId || "reaction-meme"] || [];
  } catch (err) {
    console.warn("Using offline fallback meme suggestions:", err);
    return DEFAULT_SUGGESTIONS[templateId || "reaction-meme"] || [];
  } finally {
    clearTimeout(timer);
  }
}
