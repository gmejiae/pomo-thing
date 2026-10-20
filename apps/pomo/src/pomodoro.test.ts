// @ts-ignore bun:test types are not installed; run with `bun test`
import { expect, test } from 'bun:test';
import { DEFAULTS, dayKey, fmt, lastDays, presets, readSettings, remaining, streak, suggestNext } from './pomodoro';

test('suggestNext follows the pomodoro cycle', () => {
  const [mine, deep] = presets(DEFAULTS);
  expect(suggestNext('focus', 1, mine, DEFAULTS)).toEqual({ kind: 'short', minutes: 5 });
  expect(suggestNext('focus', 4, mine, DEFAULTS)).toEqual({ kind: 'long', minutes: 15 });
  expect(suggestNext('short', 1, deep, DEFAULTS)).toEqual({ kind: 'focus', minutes: 50 });
  expect(suggestNext('long', 4, mine, DEFAULTS)).toEqual({ kind: 'focus', minutes: 25 });
  const s = { ...DEFAULTS, every: 3, long: 20 };
  expect(suggestNext('focus', 3, mine, s)).toEqual({ kind: 'long', minutes: 20 });
});

test('readSettings keeps defaults for bad values', () => {
  const s = readSettings([
    { key: 'focus', value: '40' },
    { key: 'short', value: 'abc' },
    { key: 'goal', value: '0' },
    { key: 'sound', value: 'Glass' },
  ]);
  expect(s).toEqual({ ...DEFAULTS, focus: 40 });
  expect(presets(s)[0]).toEqual({ focus: 40, short: 5 });
});

test('remaining and fmt', () => {
  expect(remaining(1000, 5000)).toBe(0);
  expect(fmt(65_000)).toBe('01:05');
  expect(fmt(64_001)).toBe('01:05');
  expect(fmt(0)).toBe('00:00');
});

test('dayKey uses the given utc offset', () => {
  const ms = Date.parse('2026-10-21T03:30:00Z');
  expect(dayKey(ms, -360)).toBe('2026-10-20');
  expect(dayKey(ms, 0)).toBe('2026-10-21');
});

test('streak and lastDays', () => {
  const days = { '2026-10-17': 2, '2026-10-18': 1, '2026-10-19': 3 };
  expect(streak(days, '2026-10-20')).toBe(3);
  expect(streak({ ...days, '2026-10-20': 1 }, '2026-10-20')).toBe(4);
  expect(streak(days, '2026-10-21')).toBe(0);
  expect(lastDays(days, '2026-10-20', 3)).toEqual([
    { key: '2026-10-18', count: 1 },
    { key: '2026-10-19', count: 3 },
    { key: '2026-10-20', count: 0 },
  ]);
});
