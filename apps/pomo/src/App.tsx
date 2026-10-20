import { BridgethingClient } from '@bridgething/client';
import { useEffect, useMemo, useState } from 'react';
import { daemonUrl } from './daemon';
import { STRINGS, langOf, type Strings } from './i18n';
import Mascot, { type Mood } from './Mascot';
import {
  DEFAULTS,
  dayKey,
  fmt,
  lastDays,
  minutesFor,
  presets,
  readSettings,
  remaining,
  streak,
  suggestNext,
  type Block,
  type Days,
  type Kind,
  type Settings,
} from './pomodoro';

type Phase = 'pick' | 'run' | 'done';
type Session = { phase: Phase; block: Block; endsAt: number | null; leftMs: number; presetIdx: number };

const KINDS: Kind[] = ['focus', 'short', 'long'];
const INITIAL: Session = {
  phase: 'pick',
  block: { kind: 'focus', minutes: 25 },
  endsAt: null,
  leftMs: 0,
  presetIdx: 0,
};

const nextAfter = (s: Session, today: number, cfg: Settings) =>
  suggestNext(s.block.kind, today + (s.block.kind === 'focus' ? 1 : 0), presets(cfg)[s.presetIdx], cfg);

function notice(s: Session, today: number, cfg: Settings, t: Strings) {
  const next = nextAfter(s, today, cfg);
  return s.block.kind === 'focus' ? t.focusDone(t.kind[next.kind], next.minutes) : t.breakDone(next.minutes);
}

export default function App() {
  const client = useMemo(() => new BridgethingClient({ url: daemonUrl() }), []);
  const [s, setS] = useState<Session>(INITIAL);
  const [days, setDays] = useState<Days>({});
  const [cfg, setCfg] = useState<Settings>(DEFAULTS);
  const [config, setConfig] = useState<Record<string, string>>({});
  // the kiosk's own timezone can be wrong; the companion's offset decides what "today" is
  const [utcOffset, setUtcOffset] = useState(-new Date().getTimezoneOffset());
  const [view, setView] = useState<'timer' | 'stats'>('timer');
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [macOk, setMacOk] = useState(false);
  const [tour, setTour] = useState<number | null>(null);

  useEffect(() => {
    const load = async (key: string) => {
      const r = await client.store.get({ key });
      if (!r.ok) throw new Error(`store ${key}`);
      return r.response.value ? JSON.parse(r.response.value) : null;
    };
    // never persist unless both loads worked, or a failed read would overwrite saved stats with {}
    Promise.all([load('session'), load('stats'), load('onboarded')])
      .then(([session, stats, onboarded]) => {
        if (session) setS({ ...INITIAL, ...session });
        if (stats) setDays(stats);
        if (!onboarded) setTour(0);
        setLoaded(true);
      })
      .catch(() => {});

    client.config.list().then(r => {
      if (r.ok) setConfig(Object.fromEntries(r.response.entries.map(e => [e.key, e.value])));
    });
    const offConfig = client.config.onChanged(c =>
      setConfig(p => {
        const next = { ...p };
        if (c.value === null) delete next[c.key];
        else next[c.key] = c.value;
        return next;
      }),
    );

    const onTime = (m: { time: { utcOffsetMinutes: number | null } }) =>
      m.time.utcOffsetMinutes !== null && setUtcOffset(m.time.utcOffsetMinutes);
    const offTime = client.time.subscribe({ snapshot: onTime, changed: onTime });
    client.time.get().then(r => r.ok && onTime(r.response));

    const offCaps = client.capabilities.subscribe({
      update: m => setMacOk(m.capabilities.available.forward),
      snapshot: m => setMacOk(m.capabilities.available.forward),
    });
    client.capabilities.get().then(r => r.ok && setMacOk(r.response.capabilities.available.forward));
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      offConfig();
      offTime();
      offCaps();
      clearInterval(tick);
    };
  }, [client]);

  // a settings change while choosing applies right away; a running block keeps its length
  useEffect(() => {
    const next = readSettings(Object.entries(config).map(([key, value]) => ({ key, value })));
    setCfg(next);
    setS(p =>
      p.phase === 'pick'
        ? { ...p, block: { ...p.block, minutes: minutesFor(p.block.kind, presets(next)[p.presetIdx], next) } }
        : p,
    );
  }, [config]);

  useEffect(() => {
    if (loaded) client.store.put({ key: 'session', value: JSON.stringify(s) }).catch(() => {});
  }, [client, loaded, s]);
  useEffect(() => {
    if (loaded) client.store.put({ key: 'stats', value: JSON.stringify(days) }).catch(() => {});
  }, [client, loaded, days]);

  const t = STRINGS[langOf(config.lang)];
  const macOn = config.mac_alerts !== 'false';
  const today = dayKey(now, utcOffset);
  const todayCount = days[today] ?? 0;

  // the mac keeps its own timer so the alert fires even when this app is not on screen
  useEffect(() => {
    if (!loaded || !macOk || s.phase === 'done') return;
    if (macOn && s.phase === 'run' && s.endsAt)
      client.forward.json({ type: 'schedule', inMs: s.endsAt - Date.now(), ...notice(s, todayCount, cfg, t) });
    else client.forward.json({ type: 'cancel' });
  }, [client, loaded, macOk, macOn, s.phase, s.endsAt]);

  const running = s.phase === 'run' && s.endsAt !== null;
  const paused = s.phase === 'run' && s.endsAt === null;
  const total = s.block.minutes * 60_000;
  const left = running ? remaining(s.endsAt!, now) : paused ? s.leftMs : total;

  useEffect(() => {
    if (!running || left > 0) return;
    if (s.block.kind === 'focus') setDays(d => ({ ...d, [today]: (d[today] ?? 0) + 1 }));
    setS(p => ({ ...p, phase: 'done', block: nextAfter(p, todayCount, cfg), endsAt: null }));
  }, [running, left]);

  const start = () => setS(p => ({ ...p, phase: 'run', endsAt: Date.now() + p.block.minutes * 60_000 }));
  const togglePause = () =>
    setS(p =>
      p.endsAt
        ? { ...p, endsAt: null, leftMs: remaining(p.endsAt, Date.now()) }
        : { ...p, endsAt: Date.now() + p.leftMs },
    );
  const cancel = () => setS(p => ({ ...p, phase: 'pick', endsAt: null }));
  // a skipped focus block moves the cycle along but never counts as a pomodoro
  const skip = () => setS(p => ({ ...p, phase: 'pick', block: nextAfter(p, todayCount, cfg), endsAt: null }));
  const setMinutes = (d: number) =>
    setS(p => ({ ...p, block: { ...p.block, minutes: Math.min(120, Math.max(1, p.block.minutes + d)) } }));
  const choosePreset = (i: number) =>
    setS(p => ({
      ...p,
      presetIdx: i,
      block: { kind: p.block.kind, minutes: minutesFor(p.block.kind, presets(cfg)[i], cfg) },
    }));
  const cycleKind = () =>
    setS(p => {
      const kind = KINDS[(KINDS.indexOf(p.block.kind) + 1) % KINDS.length];
      return { ...p, block: { kind, minutes: minutesFor(kind, presets(cfg)[p.presetIdx], cfg) } };
    });
  const primary = s.phase === 'run' ? togglePause : start;
  const toggleStats = () => setView(v => (v === 'stats' ? 'timer' : 'stats'));
  const endTour = () => {
    setTour(null);
    client.store.put({ key: 'onboarded', value: '1' }).catch(() => {});
  };
  const tourStep = (d: number) =>
    tour !== null && (tour + d >= t.tour.length ? endTour() : setTour(Math.max(0, tour + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tour !== null) e.key === 'Enter' ? tourStep(1) : e.key === 'Escape' && tourStep(-1);
      else if (e.key === '4') toggleStats();
      else if (view === 'stats') e.key === 'Escape' && setView('timer');
      else if (e.key === 'Enter') primary();
      else if (e.key === 'Escape') s.phase !== 'pick' && cancel();
      else if (s.phase === 'run') e.key === 'm' && skip();
      else if (e.key === 'm') cycleKind();
      else if (['1', '2', '3'].includes(e.key)) choosePreset(Number(e.key) - 1);
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaX) return;
      if (tour !== null) tourStep(Math.sign(e.deltaX));
      else if (view === 'timer' && s.phase !== 'run') setMinutes(Math.sign(e.deltaX));
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  });

  const mood: Mood = s.phase === 'done' ? 'done' : !running ? 'idle' : s.block.kind === 'focus' ? 'focus' : 'rest';
  const progress = s.phase === 'run' ? 1 - left / total : s.phase === 'done' ? 1 : 0;
  const R = 150;
  const C = 2 * Math.PI * R;
  const ring = s.block.kind === 'focus' && s.phase !== 'done' ? '#a395ff' : '#8fd8f0';

  // the rotary knob sits over the screen's right edge (about x>760, y 40..260), so the right side stays clear
  return (
    <div className="flex h-full w-full items-center gap-6 pr-14 pl-5">
      <div className="relative h-[300px] w-[300px] shrink-0">
        <svg viewBox="0 0 340 340" className="absolute inset-0 -rotate-90">
          <circle cx="170" cy="170" r={R} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="16" />
          <circle
            cx="170"
            cy="170"
            r={R}
            fill="none"
            stroke={ring}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.25s linear', filter: `drop-shadow(0 0 8px ${ring})` }}
          />
        </svg>
        <div className="absolute inset-[34px]">
          <Mascot
            mood={mood}
            growth={todayCount / cfg.goal}
            topic={tour !== null || s.phase === 'run' ? null : s.block.kind === 'focus' ? 'focus' : 'break'}
            cheer={s.phase === 'done'}
            t={t}
          />
        </div>
      </div>

      {tour !== null ? (
        <Tour step={tour} t={t} onNext={() => tourStep(1)} onSkip={endTour} />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <button className="glass press rounded-full px-4 py-1.5 text-[20px] font-medium" onClick={toggleStats}>
              {view === 'stats' ? t.progress : s.phase === 'done' ? t.didIt : t.kind[s.block.kind]}
              <span className="text-soft">
                {' '}
                · 🍅 {todayCount}/{cfg.goal}
              </span>
            </button>
            <span className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[18px] text-soft">
              {macOn && <span className={`h-2.5 w-2.5 rounded-full ${macOk ? 'bg-ok' : 'bg-warn'}`} />}
              {!macOn ? t.macOff : macOk ? t.mac : t.noMac}
            </span>
          </div>

          {view === 'stats' ? (
            <Stats
              days={days}
              today={today}
              todayCount={todayCount}
              goal={cfg.goal}
              t={t}
              onBack={() => setView('timer')}
              onTour={() => (setView('timer'), setTour(0))}
            />
          ) : (
            <>
              <div className="text-[28px] leading-tight text-soft">
                {s.phase === 'run' ? (
                  paused ? (
                    t.paused
                  ) : s.block.kind === 'focus' ? (
                    t.focusing
                  ) : (
                    t.resting
                  )
                ) : (
                  <>
                    {(s.phase === 'done' ? t.next : t.ask)[0]}
                    <span className="font-medium text-ink">{t.kind[s.block.kind].toLowerCase()}</span>
                    {(s.phase === 'done' ? t.next : t.ask)[1]}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between">
                {s.phase !== 'run' && (
                  <button
                    className="glass press h-14 w-14 shrink-0 rounded-full text-[34px] leading-none"
                    onClick={() => setMinutes(-1)}>
                    −
                  </button>
                )}
                <div
                  className={`font-semibold leading-none tracking-tight tabular-nums ${s.phase === 'run' ? 'text-[124px]' : 'text-[100px]'}`}>
                  {fmt(left)}
                </div>
                {s.phase !== 'run' && (
                  <button
                    className="glass press h-14 w-14 shrink-0 rounded-full text-[34px] leading-none"
                    onClick={() => setMinutes(1)}>
                    +
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  className="btn-primary press h-[72px] flex-1 rounded-full text-[30px] font-semibold"
                  onClick={primary}>
                  {s.phase === 'run' ? (paused ? t.resume : t.pause) : t.start}
                </button>
                {s.phase !== 'pick' && (
                  <button
                    className="glass press rounded-full px-6 text-[24px] font-medium"
                    onClick={s.phase === 'done' ? cancel : skip}>
                    {s.phase === 'done' ? t.choose : t.skip}
                  </button>
                )}
              </div>

              {s.phase === 'run' ? (
                <div className="text-[20px] text-soft">{t.runHint}</div>
              ) : (
                <div className="flex gap-2.5">
                  {presets(cfg).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => choosePreset(i)}
                      className={`press flex-1 rounded-[22px] px-3 py-2.5 text-left ${i === s.presetIdx ? 'glass-lilac' : 'glass'}`}>
                      <div className="text-[22px] font-medium">{t.preset[i]}</div>
                      <div className="flex justify-between text-[20px] text-soft">
                        {p.focus}/{p.short}
                        <span className="text-dim">{i + 1}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Tour({ step, t, onNext, onSkip }: { step: number; t: Strings; onNext: () => void; onSkip: () => void }) {
  const [title, body] = t.tour[step];
  const last = step === t.tour.length - 1;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex gap-2">
        {t.tour.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 rounded-full transition-all ${i === step ? 'w-8 bg-lilac-light' : 'w-2.5 bg-white/25'}`}
          />
        ))}
      </div>
      <div key={step} className="tour-step flex flex-col gap-3">
        <div className="text-[34px] leading-tight font-semibold">{title}</div>
        <div className="min-h-[150px] text-[23px] leading-snug text-soft">{body}</div>
      </div>
      <div className="flex gap-3">
        <button className="btn-primary press h-[68px] flex-1 rounded-full text-[28px] font-semibold" onClick={onNext}>
          {last ? t.tourDone : t.tourNext}
        </button>
        {!last && (
          <button className="glass press rounded-full px-6 text-[22px] font-medium" onClick={onSkip}>
            {t.tourSkip}
          </button>
        )}
      </div>
    </div>
  );
}

function Stats({
  days,
  today,
  todayCount,
  goal,
  t,
  onBack,
  onTour,
}: {
  days: Days;
  today: string;
  todayCount: number;
  goal: number;
  t: Strings;
  onBack: () => void;
  onTour: () => void;
}) {
  const week = lastDays(days, today, 7);
  const max = Math.max(goal, ...week.map(d => d.count));
  const run = streak(days, today);
  return (
    <>
      <div className="flex gap-3">
        <div className="glass flex-1 rounded-[24px] px-4 py-3">
          <div className="text-[18px] text-soft">{t.today}</div>
          <div className="text-[52px] leading-none font-semibold">
            {todayCount}
            <span className="text-[28px] text-dim">/{goal}</span>
          </div>
          <div className="mt-1 text-[18px] text-soft">{todayCount >= goal ? t.goalMet : t.toGo(goal - todayCount)}</div>
        </div>
        <div className="glass flex-1 rounded-[24px] px-4 py-3">
          <div className="text-[18px] text-soft">{t.streak}</div>
          <div className="text-[52px] leading-none font-semibold text-lilac-light">
            {run}
            <span className="text-[28px] text-dim"> {t.days(run)}</span>
          </div>
          <div className="mt-1 text-[18px] text-soft">{run ? t.keepIt : t.startToday}</div>
        </div>
      </div>

      <div className="glass flex h-[150px] items-end gap-2 rounded-[24px] px-4 pt-2 pb-2">
        {week.map(d => (
          <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="text-[18px] font-medium text-soft">{d.count || ''}</div>
            <div
              className="w-[60%] rounded-full"
              style={{
                height: `${Math.max(8, (d.count / max) * 80)}px`,
                background: d.key === today ? 'linear-gradient(180deg, #c9c1ff, #7a68f2)' : 'rgb(255 255 255 / 0.18)',
              }}
            />
            <div className={`text-[18px] ${d.key === today ? 'font-semibold text-ink' : 'text-dim'}`}>
              {t.weekday[new Date(d.key).getUTCDay()]}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button className="glass press h-14 flex-1 rounded-full text-[22px] font-medium" onClick={onBack}>
          {t.backToTimer}
        </button>
        <button className="glass press h-14 flex-1 rounded-full text-[22px] font-medium" onClick={onTour}>
          {t.tutorial}
        </button>
      </div>
    </>
  );
}
