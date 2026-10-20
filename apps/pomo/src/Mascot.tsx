import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Strings } from './i18n';

export type Mood = 'idle' | 'focus' | 'rest' | 'done';
export type Topic = 'focus' | 'break' | null;
type Face = Mood | 'laugh' | 'boop';

const ACTS = ['hop', 'wiggle', 'peek', 'squish', 'spin'];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// original mochi character; the sprout grows with the day's pomodoros (growth 0..1) and blooms at the goal.
// it fidgets on its own, chats while the timer is not running, jumps when tapped and laughs when tickled.
export default function Mascot({
  mood,
  growth,
  topic,
  cheer,
  t,
}: {
  mood: Mood;
  growth: number;
  topic: Topic;
  cheer: boolean;
  t: Strings;
}) {
  const [act, setAct] = useState<string | null>(null);
  const [face, setFace] = useState<Face | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const actTimer = useRef(0);
  const sayTimer = useRef(0);
  const touch = useRef({ down: false, x: 0, y: 0, dist: 0, tickled: false, taps: [] as number[] });

  const play = (name: string, ms: number, reaction: Face | null = null) => {
    setAct(name);
    setFace(reaction);
    clearTimeout(actTimer.current);
    actTimer.current = window.setTimeout(() => (setAct(null), setFace(null)), ms);
  };
  const speak = (text: string, ms = 5000) => {
    setSay(text);
    clearTimeout(sayTimer.current);
    sayTimer.current = window.setTimeout(() => setSay(null), ms);
  };

  useEffect(() => {
    let t = 0;
    const loop = () => {
      t = window.setTimeout(() => {
        // during focus it only glances around, so it does not distract
        play(mood === 'focus' ? 'peek' : pick(ACTS), 1400);
        loop();
      }, 5000 + Math.random() * 7000);
    };
    loop();
    return () => clearTimeout(t);
  }, [mood]);

  useEffect(() => {
    if (!topic) return setSay(null);
    speak(cheer ? pick(t.cheers) : pick(t.lines[topic]));
    const timer = window.setInterval(() => speak(pick(t.lines[topic])), 11_000);
    return () => clearInterval(timer);
  }, [topic, cheer, t]);

  useEffect(() => () => (clearTimeout(actTimer.current), clearTimeout(sayTimer.current)), []);

  const tickle = () => {
    touch.current.taps = [];
    touch.current.tickled = true;
    play('laugh', 1800, 'laugh');
    speak(pick(t.tickles), 2600);
  };
  const onDown = (e: PointerEvent) => {
    // keep receiving moves while the finger rubs past the edge of the character
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(touch.current, { down: true, x: e.clientX, y: e.clientY, dist: 0, tickled: false });
  };
  const onMove = (e: PointerEvent) => {
    const tc = touch.current;
    if (!tc.down) return;
    tc.dist += Math.hypot(e.clientX - tc.x, e.clientY - tc.y);
    Object.assign(tc, { x: e.clientX, y: e.clientY });
    if (tc.dist > 120 && !tc.tickled) tickle(); // about one swipe across its ~165px body
  };
  const onUp = () => {
    const tc = touch.current;
    tc.down = false;
    if (tc.tickled || tc.dist > 30) return;
    const now = Date.now();
    tc.taps = [...tc.taps.filter(x => now - x < 1200), now];
    if (tc.taps.length >= 3) tickle(); // quick taps tickle too
    else {
      play('jump', 700, 'boop');
      speak(pick(t.taps), 2200);
    }
  };

  const shown: Face = face ?? mood;
  const stem = 14 + Math.min(1, growth) * 26;
  const top = 62 - stem;
  return (
    <div
      className="relative h-full w-full touch-none select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => (touch.current.down = false)}>
      {say && (
        <div
          key={say}
          className="glass bubble absolute bottom-[calc(100%+6px)] left-1/2 w-max max-w-[290px] rounded-[20px] px-4 py-2 text-center text-[20px] leading-snug font-medium">
          {say}
        </div>
      )}
      <svg
        viewBox="0 0 200 200"
        className={`mascot mascot-${shown} ${act ? `mascot-act-${act}` : ''}`}
        role="img"
        aria-label="mascota">
        <defs>
          <radialGradient id="mochi" cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#ffc38f" />
            <stop offset="0.45" stopColor="#ff9a4d" />
            <stop offset="1" stopColor="#f26a24" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="186" rx="58" ry="8" fill="#000" opacity="0.3" className="mascot-shadow" />
        <g className="mascot-body">
          <path d={`M100 62 Q101 ${62 - stem / 2} 100 ${top}`} stroke="#5dbb63" strokeWidth="5" strokeLinecap="round" fill="none" />
          <g className="mascot-leaves">
            <path d={`M100 ${top} q-22 -6 -26 -20 q18 0 26 20z`} fill="#6fd17a" />
            <path d={`M100 ${top} q22 -6 26 -20 q-18 0 -26 20z`} fill="#5dbb63" />
          </g>
          {growth >= 1 && (
            <g className="mascot-flower">
              {[0, 72, 144, 216, 288].map(a => (
                <circle
                  key={a}
                  cx={100 + 8 * Math.sin((a * Math.PI) / 180)}
                  cy={top - 8 - 8 * Math.cos((a * Math.PI) / 180)}
                  r="6.5"
                  fill="#ff8fb1"
                />
              ))}
              <circle cx="100" cy={top - 8} r="5" fill="#ffd54f" />
            </g>
          )}
          <path
            d="M100 58 C150 58 172 100 172 136 C172 170 140 182 100 182 C60 182 28 170 28 136 C28 100 50 58 100 58Z"
            fill="url(#mochi)"
          />
          <ellipse cx="74" cy="86" rx="18" ry="10" fill="#fff" opacity="0.45" transform="rotate(-20 74 86)" />
          <FaceArt face={shown} />
          <ellipse cx="58" cy="140" rx="11" ry="7" fill="#ff5e7a" opacity={shown === 'laugh' ? 0.75 : 0.4} />
          <ellipse cx="142" cy="140" rx="11" ry="7" fill="#ff5e7a" opacity={shown === 'laugh' ? 0.75 : 0.4} />
        </g>
        {(shown === 'done' || shown === 'laugh') && (
          <g className="mascot-sparkles" fill="#fff">
            <path d="M30 60 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z" />
            <path d="M168 44 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" />
            <path d="M176 104 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" />
          </g>
        )}
      </svg>
    </div>
  );
}

function FaceArt({ face }: { face: Face }) {
  const ink = '#3a1d10';
  if (face === 'rest')
    return (
      <g stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M66 124 q10 -9 20 0" />
        <path d="M114 124 q10 -9 20 0" />
        <path d="M92 146 q8 6 16 0" />
      </g>
    );
  if (face === 'done')
    return (
      <g>
        <g stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M64 126 q12 -14 24 0" />
          <path d="M112 126 q12 -14 24 0" />
        </g>
        <path d="M84 140 q16 22 32 0z" fill={ink} />
      </g>
    );
  if (face === 'laugh')
    return (
      <g>
        <g stroke={ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M66 114 l14 8 l-14 8" />
          <path d="M134 114 l-14 8 l14 8" />
        </g>
        <path d="M80 138 q20 32 40 0z" fill={ink} />
        <path d="M90 150 q10 8 20 0 q-10 -6 -20 0z" fill="#ff7a8a" />
      </g>
    );
  if (face === 'boop')
    return (
      <g fill={ink}>
        <circle cx="76" cy="122" r="9" />
        <circle cx="124" cy="122" r="9" />
        <circle cx="79" cy="118" r="3" fill="#fff" />
        <circle cx="127" cy="118" r="3" fill="#fff" />
        <ellipse cx="100" cy="148" rx="7" ry="8" />
      </g>
    );
  return (
    <g>
      <g className="mascot-look">
        <g className="mascot-eyes" fill={ink}>
          <ellipse cx="76" cy="122" rx="7" ry={face === 'focus' ? 6 : 9} />
          <ellipse cx="124" cy="122" rx="7" ry={face === 'focus' ? 6 : 9} />
          <circle cx="78" cy="119" r="2.5" fill="#fff" />
          <circle cx="126" cy="119" r="2.5" fill="#fff" />
        </g>
      </g>
      {face === 'focus' ? (
        <g stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M66 106 l18 4" />
          <path d="M134 106 l-18 4" />
          <path d="M94 146 h12" />
        </g>
      ) : (
        <path d="M90 142 q10 10 20 0" stroke={ink} strokeWidth="5" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}
