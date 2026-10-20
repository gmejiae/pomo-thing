export type Kind = 'focus' | 'short' | 'long';
export type Block = { kind: Kind; minutes: number };
export type Preset = { focus: number; short: number };
export type Settings = { focus: number; short: number; long: number; every: number; goal: number };
export type Days = Record<string, number>;

export const DEFAULTS: Settings = { focus: 25, short: 5, long: 15, every: 4, goal: 8 };

// config values arrive as strings from the companion; anything out of range keeps the default
export function readSettings(entries: { key: string; value: string }[]): Settings {
  const s = { ...DEFAULTS };
  for (const { key, value } of entries) {
    const n = Math.round(Number(value));
    if (key in s && n >= 1 && n <= 120) s[key as keyof Settings] = n;
  }
  return s;
}

export const presets = (s: Settings): Preset[] => [
  { focus: s.focus, short: s.short },
  { focus: 50, short: 10 },
  { focus: 15, short: 3 },
];

export const minutesFor = (kind: Kind, preset: Preset, s: Settings) =>
  kind === 'focus' ? preset.focus : kind === 'short' ? preset.short : s.long;

// focusToday already counts the block that just finished
export function suggestNext(finished: Kind, focusToday: number, preset: Preset, s: Settings): Block {
  const kind: Kind = finished !== 'focus' ? 'focus' : focusToday % s.every === 0 ? 'long' : 'short';
  return { kind, minutes: minutesFor(kind, preset, s) };
}

export const remaining = (endsAt: number, now: number) => Math.max(0, endsAt - now);

export function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const dayKey = (ms: number, utcOffsetMin: number) => new Date(ms + utcOffsetMin * 60_000).toISOString().slice(0, 10);
const shift = (key: string, d: number) => new Date(Date.parse(key) + d * 86_400_000).toISOString().slice(0, 10);

// a day without pomodoros yet does not break the streak until it is over
export function streak(days: Days, today: string) {
  let n = 0;
  for (let k = days[today] ? today : shift(today, -1); days[k]; k = shift(k, -1)) n++;
  return n;
}

export const lastDays = (days: Days, today: string, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const key = shift(today, i - n + 1);
    return { key, count: days[key] ?? 0 };
  });
