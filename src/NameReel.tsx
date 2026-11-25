import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Series,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadQuran } from "@remotion/google-fonts/AmiriQuran";
import { loadFont as loadRuqaa } from "@remotion/google-fonts/ArefRuqaa";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { Scene, Storyboard, Timed } from "./types";

const serif = loadSerif("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] }).fontFamily;
const quran = loadQuran("normal", { weights: ["400"], subsets: ["arabic"] }).fontFamily;
const ruqaa = loadRuqaa("normal", { weights: ["700"], subsets: ["arabic"] }).fontFamily;
const cinzel = loadCinzel("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily;
const inter = loadInter("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }).fontFamily;

const C = {
  gold: "#E4C47E",
  goldSoft: "rgba(228,196,126,0.35)",
  cream: "#F4EDDF",
  muted: "#9AA0C3",
  night: "#060A1C",
  deep: "#121A3E",
};
const FADE = 12;
const AUDIO_FADE = 8;

/* ---------- timing helpers ---------- */

const sceneFrames = (s: Scene, fps: number) => Math.round((s.audio.to - s.audio.from) * fps);
export const totalFrames = (sb: Storyboard) => sb.scenes.reduce((n, s) => n + sceneFrames(s, sb.fps), 0);

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const appear = (frame: number, start: number, dur = 18) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: ease });

/** frame where a timed line starts, inside the current scene */
const useAt = () => {
  const { fps } = useVideoConfig();
  return (t: Timed | number) => Math.round((typeof t === "number" ? t : t.at) * fps);
};

/** index of the line currently being spoken */
const useCurrentLine = (lines: Timed[]) => {
  const frame = useCurrentFrame();
  const at = useAt();
  return lines.reduce((cur, l, i) => (frame >= at(l) ? i : cur), 0);
};

/* ---------- shared visuals ---------- */

const Center: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 40 }) => (
  <AbsoluteFill
    style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", padding: "0 90px", textAlign: "center", gap }}
  >
    {children}
  </AbsoluteFill>
);

const Divider: React.FC<{ width: number; opacity?: number }> = ({ width, opacity = 1 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, opacity }}>
    <div style={{ width, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
    <div style={{ width: 10, height: 10, transform: "rotate(45deg)", border: `1.5px solid ${C.gold}` }} />
    <div style={{ width, height: 1.5, background: `linear-gradient(270deg, transparent, ${C.gold})` }} />
  </div>
);

/** The line being spoken right now, cross-fading as the speaker moves on. */
const Caption: React.FC<{ lines: Timed[]; size?: number }> = ({ lines, size = 50 }) => {
  const frame = useCurrentFrame();
  const at = useAt();
  const i = useCurrentLine(lines);
  if (!lines.length) return null;
  const o = appear(frame, at(lines[i]), 12);
  return (
    <div
      style={{
        fontFamily: serif, fontStyle: "italic", fontSize: size, color: C.cream, maxWidth: 880, lineHeight: 1.3,
        minHeight: size * 2.6, opacity: o, transform: `translateY(${(1 - o) * 16}px)`,
      }}
    >
      {lines[i].text}
    </div>
  );
};

const starPath = (cx: number, cy: number, r: number) => {
  const pts = new Array(16).fill(0).map((_, i) => {
    const rr = i % 2 === 0 ? r : r * 0.72;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
  });
  return `M${pts.join("L")}Z`;
};

const archPath = (x: number, y: number, w: number, h: number) => {
  const s = y + h * 0.42;
  return `M${x},${y + h} L${x},${s} Q${x},${y + h * 0.12} ${x + w / 2},${y} Q${x + w},${y + h * 0.12} ${x + w},${s} L${x + w},${y + h} Z`;
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const stars = React.useMemo(
    () =>
      new Array(140).fill(0).map((_, i) => ({
        x: random(`x${i}`) * width, y: random(`y${i}`) * height, r: 0.6 + random(`r${i}`) * 1.8,
        p: random(`p${i}`) * Math.PI * 2, s: 0.02 + random(`s${i}`) * 0.05,
      })),
    [width, height]
  );
  const cx = width / 2;
  const cy = height * 0.46;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${C.deep} 0%, ${C.night} 70%)` }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y - frame * 0.15 * s.r} r={s.r} fill={C.cream}
            opacity={0.15 + 0.35 * (0.5 + 0.5 * Math.sin(frame * s.s + s.p))} />
        ))}
        <g transform={`rotate(${frame * 0.04} ${cx} ${cy})`} opacity={0.07}>
          {[520, 400, 280].map((r, i) => (
            <path key={r} d={starPath(cx, cy, r)} fill="none" stroke={C.gold} strokeWidth={1.5}
              transform={`rotate(${i * 22.5} ${cx} ${cy})`} />
          ))}
          <circle cx={cx} cy={cy} r={600} fill="none" stroke={C.gold} strokeWidth={1} />
        </g>
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

/* ---------- scenes: each reads the same Scene shape ---------- */

type P = { scene: Scene };

/** Lines stack up as spoken; earlier ones dim. Shows the last 4. */
const Lines: React.FC<P> = ({ scene }) => {
  const frame = useCurrentFrame();
  const at = useAt();
  const cur = useCurrentLine(scene.lines);
  const visible = scene.lines.map((l, i) => ({ ...l, i })).slice(Math.max(0, cur - 3), cur + 1);
  return (
    <Center gap={54}>
      {visible.map((l) => {
        const a = appear(frame, at(l));
        return (
          <div key={l.i}
            style={{
              fontFamily: serif, fontWeight: 500, fontSize: 62, lineHeight: 1.25,
              color: l.i === cur ? C.cream : C.muted, opacity: a * (l.i === cur ? 1 : 0.45),
              transform: `translateY(${(1 - a) * 30}px)`,
            }}
          >
            {l.text}
          </div>
        );
      })}
    </Center>
  );
};

/** Large Arabic word (an approved Name) revealed under the first caption. */
const Reveal: React.FC<P> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = useAt();
  const s = spring({ frame: frame - at(0.8), fps, config: { damping: 200, mass: 1.4 } });
  const glow = 0.5 + 0.5 * Math.sin(frame / 14);
  return (
    <Center gap={30}>
      <div
        style={{
          fontFamily: quran, fontSize: 300, lineHeight: 1.5, color: C.gold, direction: "rtl",
          opacity: s, transform: `scale(${0.85 + 0.15 * s})`,
          textShadow: `0 0 ${40 + 30 * glow}px rgba(228,196,126,${0.35 + 0.2 * glow})`,
        }}
      >
        {scene.arabic}
      </div>
      <Divider width={160} opacity={appear(frame, at(1.4))} />
      <Caption lines={scene.lines} size={54} />
    </Center>
  );
};

/** Quran card: Arabic + translation from the Quran.com API, never typed by AI. */
const VerseCard: React.FC<P> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const at = useAt();
  const v = scene.verse!;
  const words = v.arabic.split(" ");
  const start = at(0.8);
  const perWord = Math.max(2, Math.min(6, Math.floor(at(2.5) / words.length)));
  // Translation must be on screen for at least ~2s before the scene fades.
  const trans = Math.min(start + 12 + words.length * perWord + 8, durationInFrames - 60);
  const o = appear(frame, start, 24);
  return (
    <Center gap={44}>
      <Caption lines={scene.lines} size={46} />
      <div
        style={{
          width: 900, padding: "110px 60px 56px", border: `1.5px solid ${C.goldSoft}`,
          borderRadius: "450px 450px 24px 24px",
          background: "linear-gradient(180deg, rgba(228,196,126,0.08), rgba(6,10,28,0.35))",
          opacity: o, transform: `translateY(${(1 - o) * 40}px)`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 30,
        }}
      >
        <div style={{ fontFamily: cinzel, fontSize: 26, letterSpacing: 6, color: C.gold }}>
          {v.surah.toUpperCase()} · {v.key}
        </div>
        <div style={{ fontFamily: quran, fontSize: words.length > 14 ? 46 : 60, lineHeight: 2.1, color: C.cream, direction: "rtl" }}>
          {words.map((w, i) => (
            <span key={i} style={{ opacity: appear(frame, start + 12 + i * perWord, 14) }}>{w} </span>
          ))}
        </div>
        <Divider width={120} opacity={appear(frame, trans - 6)} />
        <div style={{ fontFamily: serif, fontSize: v.translation.length > 160 ? 36 : 44, lineHeight: 1.35, color: C.cream, opacity: appear(frame, trans, 24) }}>
          “{v.translation}”
        </div>
        <div style={{ fontFamily: inter, fontSize: 22, color: C.muted, opacity: appear(frame, trans + 20) }}>
          <span style={{ color: "#7FD1A8" }}>✓</span> Text verified · {v.source}
        </div>
      </div>
    </Center>
  );
};

/** 99 arches lighting up: one for each Name. */
const Doors: React.FC<P> = ({ scene }) => {
  const frame = useCurrentFrame();
  const [cols, w, h, gx, gy] = [11, 64, 92, 20, 22];
  const W = cols * w + (cols - 1) * gx;
  const H = 9 * h + 8 * gy;
  return (
    <Center gap={50}>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="doorLight" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#FFE9B8" />
            <stop offset="100%" stopColor={C.gold} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        {new Array(99).fill(0).map((_, i) => {
          const x = (i % cols) * (w + gx);
          const y = Math.floor(i / cols) * (h + gy);
          const p = appear(frame, 10 + random(`d${i}`) * 70, 20);
          return (
            <g key={i} opacity={p}>
              <path d={archPath(x, y, w, h)} fill="rgba(6,10,28,0.6)" stroke={C.gold} strokeWidth={1.2} />
              <path d={archPath(x + w * 0.2, y + h * 0.26, w * 0.6, h * 0.74)} fill="url(#doorLight)"
                opacity={p * (0.25 + 0.75 * random(`l${i}`))} />
            </g>
          );
        })}
      </svg>
      <Caption lines={scene.lines} />
    </Center>
  );
};

/** Approved Names cycling inside one glowing door. */
const Names: React.FC<P> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const names = scene.names!;
  const per = Math.max(12, Math.floor((durationInFrames - 30) / names.length));
  const idx = Math.min(names.length - 1, Math.floor(frame / per));
  const isLast = idx === names.length - 1;
  const o = interpolate(frame - idx * per, [0, 5, per - 5, per], [0, 1, 1, isLast ? 1 : 0], clamp);
  const glow = 0.5 + 0.5 * Math.sin(frame / 8);
  const n = names[idx];
  return (
    <Center gap={40}>
      <div style={{ position: "relative", width: 620, height: 800 }}>
        <svg width={620} height={800} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="doorGlow" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="rgba(255,236,190,0.55)" />
              <stop offset="100%" stopColor="rgba(228,196,126,0.04)" />
            </radialGradient>
          </defs>
          <path d={archPath(10, 10, 600, 780)} fill="url(#doorGlow)" stroke={C.gold} strokeWidth={3}
            style={{ filter: `drop-shadow(0 0 ${18 + 18 * glow}px rgba(228,196,126,0.55))` }} />
          <path d={archPath(40, 40, 540, 740)} fill="none" stroke={C.goldSoft} strokeWidth={1.5} />
        </svg>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", paddingTop: 120, opacity: o }}>
          <div style={{ fontFamily: ruqaa, fontWeight: 700, fontSize: 150, color: "#FFF6DF", direction: "rtl", textShadow: "0 0 30px rgba(255,220,150,0.7)" }}>
            {n.arabic}
          </div>
          <div style={{ fontFamily: cinzel, fontSize: 40, color: C.night, letterSpacing: 3, fontWeight: 600 }}>{n.latin}</div>
          <div style={{ fontFamily: serif, fontSize: 36, color: C.deep, fontStyle: "italic", fontWeight: 600 }}>{n.meaning}</div>
        </AbsoluteFill>
      </div>
      <Caption lines={scene.lines} />
    </Center>
  );
};

const End: React.FC<P> = ({ scene }) => {
  const frame = useCurrentFrame();
  const o = appear(frame, 4, 20);
  return (
    <Center gap={28}>
      <svg width={140} height={140} style={{ opacity: o }}>
        <path d={starPath(70, 70, 62)} fill="none" stroke={C.gold} strokeWidth={2} />
        <path d={starPath(70, 70, 40)} fill="rgba(228,196,126,0.25)" stroke={C.gold} strokeWidth={1} />
      </svg>
      <div style={{ fontFamily: cinzel, fontWeight: 600, fontSize: 58, color: C.gold, letterSpacing: 5, lineHeight: 1.3, opacity: o, textTransform: "uppercase" }}>
        {scene.title}
      </div>
      <Divider width={140} opacity={o} />
      <div style={{ position: "absolute", bottom: 120, fontFamily: inter, fontSize: 22, color: C.muted, opacity: appear(frame, 20) }}>
        {scene.footer}
      </div>
    </Center>
  );
};

const SCENES: Record<Scene["type"], React.FC<P>> = {
  lines: Lines, reveal: Reveal, verse: VerseCard, doors: Doors, names: Names, end: End,
};

/** Fades in/out, blurring out at the end. */
const SceneFade: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: d } = useVideoConfig();
  const o = interpolate(frame, [0, FADE, d - FADE, d], [0, 1, 1, 0], clamp);
  const blur = interpolate(frame, [d - FADE, d], [0, 8], clamp);
  return <AbsoluteFill style={{ opacity: o, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};

export const NameReel: React.FC<Storyboard> = ({ fps, scenes, source }) => {
  const src = staticFile(source.audioFile);
  // The end card is silent, so a speaking scene before it always fades out.
  const joined = (a?: Scene, b?: Scene) => !!a && !!b && b.type !== "end" && Math.abs(a.audio.to - b.audio.from) < 0.01;
  return (
    <AbsoluteFill style={{ backgroundColor: C.night }}>
      <Background />
      <Series>
        {scenes.map((s, i) => {
          const d = sceneFrames(s, fps);
          const fadeIn = !joined(scenes[i - 1], s);
          const fadeOut = !joined(s, scenes[i + 1]);
          const outLen = scenes[i + 1]?.type === "end" ? 30 : AUDIO_FADE;
          const Comp = SCENES[s.type];
          return (
            <Series.Sequence key={i} durationInFrames={d}>
              {s.type === "end" ? null : <Audio
                src={src}
                trimBefore={Math.round(s.audio.from * fps)}
                trimAfter={Math.round(s.audio.to * fps)}
                volume={(f) =>
                  Math.min(
                    fadeIn ? interpolate(f, [0, AUDIO_FADE], [0, 1], clamp) : 1,
                    fadeOut ? interpolate(f, [d - outLen, d], [1, 0], clamp) : 1
                  )
                }
              />}
              <SceneFade>
                <Comp scene={s} />
              </SceneFade>
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
