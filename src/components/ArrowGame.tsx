import { useState, useEffect, useRef, useCallback } from "react";
import { getRandomWord, getRandomPhrase } from "../data/texts";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import {
  playArrowShootSound,
  playArrowHitSound,
  playComboSound,
  playMissSound,
  playPauseSound,
  playResumeSound,
} from "../utils/sound";

/* ---------- types ---------- */
interface GameBubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  word: string;
  speed: number;
  hue: number;
  popping: boolean;
  opacity: number;
  scale: number;
  wobblePhase: number;
  wobbleSpeed: number;
  glowPulse: number;
}

interface Arrow {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  progress: number;
  speed: number;
  angle: number;
  hit: boolean;
  trail: { x: number; y: number }[];
  targetBubbleId: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  hue: number;
  life: number;
  char?: string;
}

interface ShockWave {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

type GameMode = "word" | "text";
type GameStatus = "idle" | "running" | "paused" | "finished";

const GAME_DURATIONS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
  { label: "30 min", seconds: 1800 },
];

const SLOW_PHASE_SECONDS = 120;
const ARROW_SPEED = 0.035;

export default function ArrowGame() {
  const { settings } = useSettings();
  const { addPerformanceRecord, isAuthenticated } = useAuth();
  const dm = settings.darkMode;

  /* ---------- state ---------- */
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [mode, setMode] = useState<GameMode>("word");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [missed, setMissed] = useState(0);
  const [popped, setPopped] = useState(0);
  const [duration, setDuration] = useState(300);
  const [timeLeft, setTimeLeft] = useState(300);
  const [bubbles, setBubbles] = useState<GameBubble[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shockWaves, setShockWaves] = useState<ShockWave[]>([]);
  const [typed, setTyped] = useState("");
  const [popEffect, setPopEffect] = useState<{ x: number; y: number; text: string } | null>(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const [difficultyLabel, setDifficultyLabel] = useState("Easy");
  const [bowAngle, setBowAngle] = useState(-90);

  /* ---------- refs ---------- */
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(0);
  const arrowIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const shockIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const correctStreakRef = useRef(0);
  const gameStatusRef = useRef<GameStatus>("idle");
  const modeRef = useRef<GameMode>("word");
  const soundEnabledRef = useRef(true);
  const bubblesRef = useRef<GameBubble[]>([]);
  const maxBubblesRef = useRef(1);
  const bubbleSizeRef = useRef(1.0);
  const savedResultRef = useRef(false);

  // keep refs in sync
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { soundEnabledRef.current = settings.soundEnabled; }, [settings.soundEnabled]);
  useEffect(() => { bubblesRef.current = bubbles; }, [bubbles]);
  useEffect(() => { maxBubblesRef.current = settings.maxBubbles; }, [settings.maxBubbles]);
  useEffect(() => { bubbleSizeRef.current = settings.bubbleSize; }, [settings.bubbleSize]);

  /* ---------- helpers ---------- */
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearTimeout(spawnRef.current);
    if (animRef.current) clearInterval(animRef.current);
    timerRef.current = null;
    spawnRef.current = null;
    animRef.current = null;
  }, []);

  const getWordForBubble = useCallback((): string => {
    if (modeRef.current === "text") return getRandomPhrase();
    const elapsed = elapsedRef.current;
    const total = duration;
    const progress = elapsed / total;
    if (progress < 0.3) return getRandomWord("easy");
    if (progress < 0.65) return getRandomWord("medium");
    return getRandomWord("hard");
  }, [duration]);

  const getSpeedMultiplier = useCallback((): number => {
    const elapsed = elapsedRef.current;
    const streak = correctStreakRef.current;
    let base: number;
    if (elapsed < SLOW_PHASE_SECONDS) {
      base = 0.3 + (elapsed / SLOW_PHASE_SECONDS) * 0.4;
    } else {
      const extra = elapsed - SLOW_PHASE_SECONDS;
      base = 0.7 + Math.min(extra / 600, 1.3);
    }
    const streakBonus = Math.floor(streak / 5) * 0.15;
    return base + Math.min(streakBonus, 1.0);
  }, []);

  const getSpawnDelay = useCallback((): number => {
    const elapsed = elapsedRef.current;
    const streak = correctStreakRef.current;
    let delay: number;
    if (elapsed < SLOW_PHASE_SECONDS) {
      delay = 3500 - (elapsed / SLOW_PHASE_SECONDS) * 1500;
    } else {
      const extra = elapsed - SLOW_PHASE_SECONDS;
      delay = Math.max(2000 - extra * 2, 800);
    }
    delay -= Math.min(streak * 30, 500);
    return Math.max(delay, 600);
  }, []);

  /* ---------- difficulty label ---------- */
  useEffect(() => {
    const elapsed = elapsedRef.current;
    if (elapsed < SLOW_PHASE_SECONDS * 0.5) setDifficultyLabel("Easy");
    else if (elapsed < SLOW_PHASE_SECONDS) setDifficultyLabel("Medium");
    else if (elapsed < SLOW_PHASE_SECONDS * 2.5) setDifficultyLabel("Hard");
    else setDifficultyLabel("Insane");
  }, [timeLeft]);

  /* ---------- bow angle tracking ---------- */
  useEffect(() => {
    const active = bubbles.find((b) => !b.popping);
    if (!active || !containerRef.current) {
      setBowAngle(-90);
      return;
    }
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const bowX = containerW / 2;
    const bowY = containerH - 40;
    const dx = active.x - bowX;
    const dy = active.y - bowY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    setBowAngle(angle);
  }, [bubbles]);

  /* ---------- create explosion ---------- */
  const createExplosion = useCallback((target: GameBubble) => {
    const newParticles: Particle[] = [];
    const particleCount = 20 + Math.floor(Math.random() * 10);
    for (let i = 0; i < particleCount; i++) {
      const pAngle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
      const speed = 2 + Math.random() * 6;
      newParticles.push({
        id: particleIdRef.current++,
        x: target.x, y: target.y,
        dx: Math.cos(pAngle) * speed,
        dy: Math.sin(pAngle) * speed - 2,
        radius: 2 + Math.random() * 5,
        hue: target.hue + Math.random() * 40 - 20,
        life: 1,
      });
    }
    for (let ci = 0; ci < Math.min(target.word.length, 10); ci++) {
      const pAngle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      newParticles.push({
        id: particleIdRef.current++,
        x: target.x + (Math.random() - 0.5) * target.radius,
        y: target.y + (Math.random() - 0.5) * target.radius * 0.5,
        dx: Math.cos(pAngle) * speed,
        dy: Math.sin(pAngle) * speed - 3,
        radius: 6, hue: target.hue, life: 1,
        char: target.word[ci].toUpperCase(),
      });
    }
    for (let i = 0; i < 8; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      newParticles.push({
        id: particleIdRef.current++,
        x: target.x, y: target.y,
        dx: Math.cos(pAngle) * speed,
        dy: Math.sin(pAngle) * speed - 1,
        radius: 3 + Math.random() * 4,
        hue: 30 + Math.random() * 30,
        life: 1,
      });
    }
    setParticles((p) => [...p, ...newParticles]);
    setShockWaves((prev) => [...prev, { id: shockIdRef.current++, x: target.x, y: target.y, radius: 10, opacity: 0.8 }]);
    setScreenFlash(true);
    setTimeout(() => setScreenFlash(false), 150);
  }, []);

  /* ---------- shoot arrow ---------- */
  const shootArrow = useCallback(
    (targetWord: string) => {
      const currentBubbles = bubblesRef.current;
      let targetBubble: GameBubble | null = null;

      for (let i = 0; i < currentBubbles.length; i++) {
        if (!currentBubbles[i].popping && currentBubbles[i].word.toLowerCase() === targetWord.toLowerCase()) {
          if (!targetBubble || currentBubbles[i].y > targetBubble.y) {
            targetBubble = currentBubbles[i];
          }
        }
      }

      if (!targetBubble) return;

      const target = targetBubble;
      const containerW = containerRef.current?.clientWidth || 800;
      const containerH = containerRef.current?.clientHeight || 600;
      const bowX = containerW / 2;
      const bowY = containerH - 40;

      const dx = target.x - bowX;
      const dy = target.y - bowY;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      if (soundEnabledRef.current) playArrowShootSound();

      const newArrow: Arrow = {
        id: arrowIdRef.current++,
        x: bowX, y: bowY,
        targetX: target.x, targetY: target.y,
        startX: bowX, startY: bowY,
        progress: 0, speed: ARROW_SPEED,
        angle, hit: false, trail: [],
        targetBubbleId: target.id,
      };
      setArrows((a) => [...a, newArrow]);

      const travelTime = (1 / ARROW_SPEED) * 16;
      const capturedTarget = { ...target };
      const capturedId = target.id;

      setTimeout(() => {
        if (soundEnabledRef.current) playArrowHitSound();
        const currentB = bubblesRef.current.find((b) => b.id === capturedId);
        const explosionTarget = currentB || capturedTarget;
        createExplosion(explosionTarget);

        setBubbles((b) => b.map((bb) => bb.id === capturedId ? { ...bb, popping: true } : bb));

        correctStreakRef.current += 1;
        setPopped((p) => p + 1);
        setCombo((c) => {
          const newCombo = c + 1;
          setMaxCombo((m) => Math.max(m, newCombo));
          const wordLenBonus = Math.floor(capturedTarget.word.length / 3);
          const points = (10 + wordLenBonus * 5) * Math.min(newCombo, 15);
          setScore((s) => s + points);
          setPopEffect({ x: explosionTarget.x, y: explosionTarget.y, text: `+${points}` });
          setTimeout(() => setPopEffect(null), 700);
          if (soundEnabledRef.current && newCombo >= 3) playComboSound(newCombo);
          return newCombo;
        });
      }, travelTime);
    },
    [createExplosion]
  );

  /* ---------- spawn bubble ---------- */
  const spawnBubble = useCallback(() => {
    if (gameStatusRef.current !== "running") return;

    setBubbles((prev) => {
      const activeCount = prev.filter((b) => !b.popping).length;
      if (activeCount >= maxBubblesRef.current) {
        spawnRef.current = setTimeout(spawnBubble, 500);
        return prev;
      }

      const containerW = containerRef.current?.clientWidth || 800;
      const word = getWordForBubble();
      const sizeMul = bubbleSizeRef.current;
      const baseRadius = modeRef.current === "text" ? 60 + word.length * 2.5 : 30 + word.length * 5;
      const radius = Math.min(baseRadius * sizeMul, 180);
      const speedMul = getSpeedMultiplier();

      const newBubble: GameBubble = {
        id: nextIdRef.current++,
        x: radius + Math.random() * Math.max(containerW - radius * 2, 50),
        y: -radius * 2,
        radius,
        word,
        speed: (0.3 + Math.random() * 0.5) * speedMul,
        hue: Math.random() * 360,
        popping: false,
        opacity: 1,
        scale: 1,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        glowPulse: 0,
      };

      const delay = getSpawnDelay();
      spawnRef.current = setTimeout(spawnBubble, delay);

      return [...prev, newBubble];
    });
  }, [getWordForBubble, getSpeedMultiplier, getSpawnDelay]);

  /* ---------- start game ---------- */
  const startGame = useCallback(() => {
    clearTimers();
    setGameStatus("running");
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setMissed(0);
    setPopped(0);
    setTimeLeft(duration);
    setBubbles([]);
    setArrows([]);
    setParticles([]);
    setShockWaves([]);
    setTyped("");
    setPopEffect(null);
    elapsedRef.current = 0;
    correctStreakRef.current = 0;
    savedResultRef.current = false;

    setTimeout(() => inputRef.current?.focus(), 100);

    timerRef.current = setInterval(() => {
      if (gameStatusRef.current === "paused") return;
      elapsedRef.current += 1;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameStatus("finished");
          clearTimers();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    spawnRef.current = setTimeout(spawnBubble, 1200);

    animRef.current = setInterval(() => {
      if (gameStatusRef.current === "paused") return;
      const containerH = containerRef.current?.clientHeight || 600;

      setBubbles((prev) => {
        const alive: GameBubble[] = [];
        let missedCount = 0;
        for (const b of prev) {
          if (b.popping) {
            const newScale = b.scale + 0.15;
            const newOpacity = b.opacity - 0.06;
            if (newOpacity > 0) alive.push({ ...b, scale: newScale, opacity: newOpacity });
          } else {
            const newY = b.y + b.speed;
            if (newY > containerH + b.radius) {
              missedCount++;
            } else {
              alive.push({
                ...b,
                y: newY,
                wobblePhase: b.wobblePhase + b.wobbleSpeed,
                glowPulse: b.glowPulse + 0.04,
              });
            }
          }
        }
        if (missedCount > 0) {
          setMissed((p) => p + missedCount);
          setCombo(0);
          correctStreakRef.current = 0;
          if (soundEnabledRef.current) playMissSound();
          setTyped("");
        }
        return alive;
      });

      // Update arrows
      setArrows((prev) =>
        prev
          .map((a) => {
            if (a.hit) return a;
            const newProgress = a.progress + a.speed;
            const currentBubs = bubblesRef.current;
            const targetB = currentBubs.find((b) => b.id === a.targetBubbleId);
            const tX = targetB ? targetB.x : a.targetX;
            const tY = targetB ? targetB.y : a.targetY;
            const newX = a.startX + (tX - a.startX) * newProgress;
            const newY = a.startY + (tY - a.startY) * newProgress;
            const dx = tX - a.startX;
            const dy = tY - a.startY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const trail = [...a.trail, { x: newX, y: newY }].slice(-14);
            if (newProgress >= 1) {
              return { ...a, x: tX, y: tY, progress: 1, hit: true, trail, angle };
            }
            return { ...a, x: newX, y: newY, progress: newProgress, trail, targetX: tX, targetY: tY, angle };
          })
          .filter((a) => !(a.hit && a.progress >= 1))
      );

      // Particles
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, x: p.x + p.dx, y: p.y + p.dy, dy: p.dy + 0.12, life: p.life - 0.025 }))
          .filter((p) => p.life > 0)
      );

      // Shockwaves
      setShockWaves((prev) =>
        prev
          .map((sw) => ({ ...sw, radius: sw.radius + 5, opacity: sw.opacity - 0.03 }))
          .filter((sw) => sw.opacity > 0)
      );
    }, 16);
  }, [duration, clearTimers, spawnBubble]);

  useEffect(() => {
    if (gameStatus !== "finished") return;
    if (savedResultRef.current) return;

    const accuracy = popped + missed > 0 ? Math.round((popped / (popped + missed)) * 100) : 0;
    addPerformanceRecord({
      type: "arrow",
      duration,
      score,
      maxCombo,
      hits: popped,
      missed,
      accuracy,
    });
    savedResultRef.current = true;
  }, [addPerformanceRecord, duration, gameStatus, maxCombo, missed, popped, score]);

  /* ---------- pause / resume ---------- */
  const togglePause = useCallback(() => {
    if (gameStatus === "running") {
      setGameStatus("paused");
      if (spawnRef.current) clearTimeout(spawnRef.current);
      spawnRef.current = null;
      if (settings.soundEnabled) playPauseSound();
    } else if (gameStatus === "paused") {
      setGameStatus("running");
      if (settings.soundEnabled) playResumeSound();
      spawnRef.current = setTimeout(spawnBubble, getSpawnDelay());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [gameStatus, settings.soundEnabled, spawnBubble, getSpawnDelay]);

  /* ---------- input handler ---------- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (gameStatus !== "running") return;
      if (e.key === "Escape") {
        togglePause();
        return;
      }
      if (e.key === " ") {
        const word = typed.trim();

        if (mode === "text") {
          const target =
            bubblesRef.current.find((b) => !b.popping)?.word.trim().toLowerCase() || "";
          const typedWord = word.toLowerCase();

          // In phrase mode: allow internal spaces while typing.
          // Only the final SPACE triggers shot when phrase is complete.
          if (typedWord.length > 0 && typedWord === target) {
            e.preventDefault();
            shootArrow(word);
            setTyped("");
          }
          return;
        }

        // Word mode: SPACE always attempts shot.
        e.preventDefault();
        if (word.length > 0) {
          shootArrow(word);
          setTyped("");
        }
      }
    },
    [gameStatus, typed, shootArrow, togglePause, mode]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (gameStatus !== "running") return;
      setTyped(e.target.value);
    },
    [gameStatus]
  );

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (gameStatus === "running" || gameStatus === "paused")) {
        togglePause();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameStatus, togglePause]);

  /* ---------- cleanup ---------- */
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const changeDuration = (sec: number) => {
    setDuration(sec);
    setTimeLeft(sec);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((duration - timeLeft) / duration) * 100;
  const activeBubble = bubbles.find((b) => !b.popping);
  const isTypedMatching = activeBubble && activeBubble.word.toLowerCase().startsWith(typed.toLowerCase());

  const containerW = containerRef.current?.clientWidth || 800;
  const containerH = containerRef.current?.clientHeight || 600;
  const bowX = containerW / 2;
  const bowY = containerH - 40;

  const bubbleFontSize = (word: string, radius: number) => {
    const len = word.length;
    const base = Math.min(radius * 0.3, 16) * settings.bubbleTextScale;
    if (len > 15) return Math.max(base * 0.6, 8);
    if (len > 10) return Math.max(base * 0.75, 9);
    if (len > 6) return Math.max(base * 0.9, 10);
    return base;
  };

  /* ---------- render ---------- */
  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      {/* Mode + Duration Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div
          className={`flex items-center gap-1 p-1 rounded-xl transition-all duration-300 ${
            dm ? "bg-gray-800/80 border border-gray-700/50" : "bg-white border border-gray-200 shadow-sm"
          }`}
        >
          <button
            onClick={() => { if (gameStatus === "idle") setMode("word"); }}
            disabled={gameStatus !== "idle"}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${
              mode === "word"
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg"
                : dm ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"
            } ${gameStatus !== "idle" ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            📝 Words
          </button>
          <button
            onClick={() => { if (gameStatus === "idle") setMode("text"); }}
            disabled={gameStatus !== "idle"}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${
              mode === "text"
                ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg"
                : dm ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"
            } ${gameStatus !== "idle" ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            📄 Phrases
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {GAME_DURATIONS.map((d) => (
            <button
              key={d.seconds}
              onClick={() => changeDuration(d.seconds)}
              disabled={gameStatus !== "idle"}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                duration === d.seconds
                  ? "bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-lg shadow-red-500/25 scale-105"
                  : dm
                  ? "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700/50"
                  : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 border border-gray-200 shadow-sm"
              } ${gameStatus !== "idle" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => settings.soundEnabled ? undefined : undefined}
          className={`px-3 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
            dm
              ? "bg-gray-800/80 text-gray-400 hover:text-white border border-gray-700/50"
              : "bg-white text-gray-500 hover:text-gray-800 border border-gray-200 shadow-sm"
          }`}
          title={settings.soundEnabled ? "Sound On (change in Settings)" : "Sound Off (change in Settings)"}
        >
          {settings.soundEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      {/* Stats Bar */}
      <div
        className={`grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 rounded-2xl backdrop-blur-xl transition-all duration-500 ${
          dm
            ? "bg-gray-900/60 border border-white/5"
            : "bg-white/70 border border-gray-200/60 shadow-lg"
        }`}
      >
        <StatItem dm={dm} label="Time Left" value={formatTime(timeLeft)} warning={timeLeft <= 30 && gameStatus === "running"} />
        <StatItem dm={dm} label="Score" value={score.toString()} gradient />
        <StatItem dm={dm} label="Combo" value={`${combo}x`} />
        <StatItem dm={dm} label="Hits" value={popped.toString()} />
        <StatItem dm={dm} label="Missed" value={missed.toString()} red={missed > 0} />
        <StatItem dm={dm} label="Speed" value={difficultyLabel} />
      </div>

      {/* Progress Bar */}
      <div className={`h-1.5 rounded-full overflow-hidden ${dm ? "bg-gray-800" : "bg-gray-200"}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            dm
              ? "bg-gradient-to-r from-red-600 via-orange-400 to-yellow-400"
              : "bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Input area */}
      {(gameStatus === "running" || gameStatus === "paused") && (
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={gameStatus === "paused"}
              placeholder={
                gameStatus === "paused"
                  ? "⏸ Game paused..."
                  : mode === "text"
                  ? "Type phrase with spaces, then final SPACE to shoot! 🏹"
                  : "Type the word → SPACE to shoot! 🏹"
              }
              className={`w-full px-5 py-3.5 rounded-xl font-semibold transition-all duration-300 outline-none ${
                dm
                  ? "bg-gray-800/80 text-white placeholder-gray-500 border-2"
                  : "bg-white/90 text-gray-800 placeholder-gray-400 border-2 shadow-sm"
              } ${
                typed.length === 0
                  ? dm ? "border-gray-700/50" : "border-gray-200"
                  : isTypedMatching
                  ? "border-emerald-500 shadow-lg shadow-emerald-500/20"
                  : "border-red-500 shadow-lg shadow-red-500/20"
              }`}
              style={{ fontFamily: `${settings.fontFamily}, monospace`, fontSize: `${Math.min(settings.fontSize, 20)}px` }}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {activeBubble && (
              <div
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 rounded-lg max-w-[40%] truncate ${
                  dm ? "bg-gray-700/60 text-gray-400" : "bg-gray-100 text-gray-500"
                }`}
              >
                🎯{" "}
                <span className={dm ? "text-orange-400" : "text-red-600"}>
                  {activeBubble.word}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={togglePause}
            className={`px-4 py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 ${
              gameStatus === "paused"
                ? "bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg shadow-emerald-500/25"
                : "bg-gradient-to-r from-amber-600 to-yellow-500 text-white shadow-lg shadow-amber-500/25"
            }`}
          >
            {gameStatus === "paused" ? "▶️ Resume" : "⏸ Pause"}
          </button>
        </div>
      )}

      {/* Game Area */}
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden transition-all duration-500 ${
          dm
            ? "bg-gray-900/70 border border-white/5 shadow-2xl"
            : "bg-gradient-to-b from-sky-50/80 to-white/90 border border-gray-200/50 shadow-xl"
        }`}
        style={{ height: "500px" }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Screen flash */}
        {screenFlash && (
          <div
            className="absolute inset-0 z-30 pointer-events-none rounded-2xl"
            style={{
              background: "radial-gradient(circle, rgba(255,150,50,0.3) 0%, transparent 70%)",
              animation: "flash-out 0.15s ease-out forwards",
            }}
          />
        )}

        {/* Shockwaves */}
        {shockWaves.map((sw) => (
          <div
            key={sw.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              left: sw.x - sw.radius,
              top: sw.y - sw.radius,
              width: sw.radius * 2,
              height: sw.radius * 2,
              border: `2px solid rgba(255, 120, 30, ${sw.opacity})`,
              boxShadow: `0 0 ${sw.radius * 0.5}px rgba(255, 120, 30, ${sw.opacity * 0.4})`,
            }}
          />
        ))}

        {/* Bubbles */}
        {bubbles.map((b) => {
          const wobbleX = Math.sin(b.wobblePhase) * 8;
          const glowIntensity = 0.3 + Math.sin(b.glowPulse) * 0.2;
          const isTarget = activeBubble && activeBubble.id === b.id;

          return (
            <div
              key={b.id}
              className="absolute flex items-center justify-center select-none"
              style={{
                left: b.x - b.radius + wobbleX,
                top: b.y - b.radius,
                width: b.radius * 2,
                height: b.radius * 2,
                transform: `scale(${b.scale})`,
                opacity: b.opacity,
                transition: b.popping ? "transform 0.3s, opacity 0.3s" : "none",
                zIndex: isTarget ? 20 : 10,
              }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center shadow-lg relative overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 35% 35%, hsla(${b.hue}, 80%, 75%, 0.92), hsla(${b.hue}, 70%, 45%, 0.88))`,
                  boxShadow: `0 0 ${isTarget ? 30 : 20}px hsla(${b.hue}, 80%, 55%, ${glowIntensity}), inset 0 -4px 8px hsla(${b.hue}, 70%, 30%, 0.3), inset 0 4px 8px hsla(${b.hue}, 80%, 85%, 0.4)`,
                  border: isTarget ? "3px solid rgba(255,255,255,0.6)" : "2px solid rgba(255,255,255,0.2)",
                }}
              >
                <div
                  className="absolute rounded-full bg-white/40"
                  style={{ width: b.radius * 0.5, height: b.radius * 0.3, top: b.radius * 0.2, left: b.radius * 0.4, borderRadius: "50%", filter: "blur(3px)" }}
                />
                {isTarget && !b.popping && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ animation: "pulse-glow 1s ease-in-out infinite" }}>
                    <svg width={b.radius * 1.2} height={b.radius * 1.2} viewBox="0 0 40 40" fill="none" className="absolute opacity-40">
                      <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="20" y1="2" x2="20" y2="10" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                      <line x1="20" y1="30" x2="20" y2="38" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                      <line x1="2" y1="20" x2="10" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                      <line x1="30" y1="20" x2="38" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                    </svg>
                  </div>
                )}
                <span
                  className="text-white font-black drop-shadow-md text-center px-2 leading-tight relative z-10"
                  style={{
                    fontFamily: `${settings.fontFamily}, monospace`,
                    textShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    fontSize: `${bubbleFontSize(b.word, b.radius)}px`,
                  }}
                >
                  {b.word}
                </span>
              </div>
              {isTarget && typed.length > 0 && (
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5 flex-wrap justify-center max-w-full">
                  {b.word.split("").map((ch, ci) => (
                    <span
                      key={ci}
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          ci < typed.length
                            ? typed[ci]?.toLowerCase() === ch.toLowerCase() ? "#10b981" : "#ef4444"
                            : dm ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Arrows in flight */}
        {arrows.map((a) => {
          if (a.hit) return null;
          return (
            <div key={a.id} className="absolute pointer-events-none" style={{ zIndex: 25 }}>
              {a.trail.map((t, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: t.x - 2, top: t.y - 2,
                    width: 4 - (i / a.trail.length) * 3,
                    height: 4 - (i / a.trail.length) * 3,
                    background: `rgba(255, ${150 + i * 8}, 50, ${(i / a.trail.length) * 0.7})`,
                    boxShadow: `0 0 ${4 + i}px rgba(255, 150, 50, ${(i / a.trail.length) * 0.4})`,
                  }}
                />
              ))}
              <div
                className="absolute"
                style={{
                  left: a.x - 12, top: a.y - 12,
                  width: 24, height: 24,
                  transform: `rotate(${a.angle + 90}deg)`,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <line x1="12" y1="24" x2="12" y2="6" stroke="#fbbf24" strokeWidth="2" />
                  <polygon points="12,0 7,8 12,6 17,8" fill="#ef4444" stroke="#fbbf24" strokeWidth="0.5" />
                  <polygon points="12,24 9,20 12,21" fill="#dc2626" opacity="0.8" />
                  <polygon points="12,24 15,20 12,21" fill="#dc2626" opacity="0.8" />
                </svg>
              </div>
              <div
                className="absolute rounded-full"
                style={{
                  left: a.x - 8, top: a.y - 8,
                  width: 16, height: 16,
                  background: "radial-gradient(circle, rgba(255,180,50,0.5), transparent)",
                  filter: "blur(4px)",
                }}
              />
            </div>
          );
        })}

        {/* Particles */}
        {particles.map((p) =>
          p.char ? (
            <div
              key={p.id}
              className="absolute pointer-events-none font-black select-none"
              style={{
                left: p.x - 6, top: p.y - 6,
                fontSize: "12px",
                color: `hsla(${p.hue}, 80%, 70%, ${p.life})`,
                textShadow: `0 0 6px hsla(${p.hue}, 80%, 60%, ${p.life * 0.5})`,
                fontFamily: `${settings.fontFamily}, monospace`,
              }}
            >
              {p.char}
            </div>
          ) : (
            <div
              key={p.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: p.x - p.radius, top: p.y - p.radius,
                width: p.radius * 2, height: p.radius * 2,
                background: `hsla(${p.hue}, 80%, 60%, ${p.life})`,
                boxShadow: `0 0 ${p.radius * 3}px hsla(${p.hue}, 80%, 60%, ${p.life * 0.5})`,
              }}
            />
          )
        )}

        {/* Pop effect text */}
        {popEffect && (
          <div
            className="absolute pointer-events-none font-black text-xl animate-float-up z-30"
            style={{
              left: popEffect.x - 30, top: popEffect.y - 30,
              color: dm ? "#fde68a" : "#f59e0b",
              fontFamily: `${settings.fontFamily}, monospace`,
              textShadow: "0 0 15px currentColor, 0 0 30px currentColor",
            }}
          >
            {popEffect.text}
          </div>
        )}

        {/* Combo overlay */}
        {combo >= 3 && gameStatus === "running" && (
          <div className="absolute top-4 right-4 z-30 pointer-events-none" style={{ animation: "pulse-glow 0.6s ease-in-out infinite alternate" }}>
            <div
              className={`px-4 py-2 rounded-xl font-black text-lg ${
                combo >= 10
                  ? "bg-gradient-to-r from-yellow-500 to-red-500 text-white"
                  : combo >= 5
                  ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                  : "bg-gradient-to-r from-red-500 to-orange-500 text-white"
              }`}
              style={{ fontFamily: `${settings.fontFamily}, monospace` }}
            >
              🔥 {combo}x COMBO!
            </div>
          </div>
        )}

        {/* Bow */}
        {(gameStatus === "running" || gameStatus === "paused") && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: bowX - 30, top: bowY - 30,
              width: 60, height: 60,
              transform: `rotate(${bowAngle + 90}deg)`,
              transition: "transform 0.2s ease-out",
              zIndex: 15,
            }}
          >
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="drop-shadow-lg">
              <path d="M 10 50 Q 10 10, 30 5 Q 50 10, 50 50" stroke={dm ? "#f59e0b" : "#d97706"} strokeWidth="3" fill="none" strokeLinecap="round" />
              <line x1="10" y1="50" x2="30" y2="42" stroke={dm ? "#e5e7eb" : "#6b7280"} strokeWidth="1.5" />
              <line x1="50" y1="50" x2="30" y2="42" stroke={dm ? "#e5e7eb" : "#6b7280"} strokeWidth="1.5" />
              <line x1="30" y1="42" x2="30" y2="10" stroke="#fbbf24" strokeWidth="2" />
              <polygon points="30,5 26,14 30,11 34,14" fill="#ef4444" />
              <rect x="27" y="38" width="6" height="10" rx="2" fill={dm ? "#78716c" : "#a8a29e"} />
            </svg>
            <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.2), transparent)", filter: "blur(8px)" }} />
          </div>
        )}

        {/* Aiming line */}
        {activeBubble && gameStatus === "running" && typed.length > 0 && isTypedMatching && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 14 }}>
            <line
              x1={bowX} y1={bowY}
              x2={activeBubble.x} y2={activeBubble.y}
              stroke={dm ? "rgba(251,191,36,0.15)" : "rgba(217,119,6,0.12)"}
              strokeWidth="1" strokeDasharray="6 4"
            />
          </svg>
        )}

        {/* Ground */}
        {(gameStatus === "running" || gameStatus === "paused") && (
          <div
            className="absolute bottom-0 left-0 right-0 h-8"
            style={{
              background: dm
                ? "linear-gradient(to top, rgba(30,20,10,0.8), rgba(30,20,10,0.2), transparent)"
                : "linear-gradient(to top, rgba(139,90,43,0.15), rgba(139,90,43,0.05), transparent)",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: dm ? "rgba(251,191,36,0.15)" : "rgba(139,90,43,0.1)" }} />
          </div>
        )}

        {/* Danger zone */}
        {gameStatus === "running" && (
          <div className="absolute bottom-8 left-0 right-0 h-3 opacity-40 z-0" style={{ background: "linear-gradient(to top, rgba(239,68,68,0.6), transparent)" }} />
        )}

        {/* Idle overlay */}
        {gameStatus === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] z-40">
            <div
              className={`text-center px-8 py-8 rounded-3xl transition-all max-w-md ${
                dm ? "bg-gray-900/95 border border-white/10 shadow-2xl" : "bg-white/98 border border-gray-200 shadow-2xl"
              }`}
              style={{ animation: "scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              <p className="text-5xl mb-4">🏹💥</p>
              <h3 className={`text-2xl font-black mb-2 ${dm ? "text-white" : "text-gray-800"}`}>Arrow Attack!</h3>
              <p className={`text-sm mb-2 ${dm ? "text-gray-400" : "text-gray-500"}`}>
                Mode: <span className="font-bold">{mode === "word" ? "📝 Words" : "📄 Text Phrases"}</span>
              </p>
              <div className={`text-xs mb-5 p-3 rounded-xl leading-relaxed ${dm ? "bg-gray-800/80 text-gray-300" : "bg-gray-50 text-gray-600"}`}>
                <p className="mb-1">🫧 Bubbles fall one at a time from the top</p>
                <p className="mb-1">🏹 Bow <span className="font-bold text-amber-500">auto-aims</span> at the active bubble</p>
                <p className="mb-1">
                    ⌨️ Type the {mode === "word" ? "word" : "complete phrase (with spaces)"} → <span className="font-bold text-amber-500">final SPACE</span> to shoot! 🏹
                </p>
                <p className="mb-1">🐌 First 2 min: slow — then speed increases!</p>
                <p className="mb-1">⚙️ Adjust bubble size & count in <span className="font-bold">Settings</span></p>
                <p>⏸ Press <span className="font-bold">ESC</span> to pause anytime</p>
              </div>
              <button
                onClick={startGame}
                className="px-8 py-3 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95 bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-lg shadow-red-500/25"
              >
                🏹 Start Game
              </button>
            </div>
          </div>
        )}

        {/* Pause overlay */}
        {gameStatus === "paused" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40">
            <div
              className={`text-center px-8 py-8 rounded-3xl transition-all ${
                dm ? "bg-gray-900/95 border border-white/10 shadow-2xl" : "bg-white/98 border border-gray-200 shadow-2xl"
              }`}
              style={{ animation: "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              <p className="text-5xl mb-3">⏸️</p>
              <h3 className={`text-2xl font-black mb-2 ${dm ? "text-white" : "text-gray-800"}`}>Game Paused</h3>
              <p className={`text-sm mb-5 ${dm ? "text-gray-400" : "text-gray-500"}`}>
                Score: {score} • Combo: {combo}x • Time: {formatTime(timeLeft)}
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={togglePause} className="px-6 py-3 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95 bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg shadow-emerald-500/25">
                  ▶️ Resume
                </button>
                <button
                  onClick={() => { clearTimers(); setGameStatus("idle"); setBubbles([]); setArrows([]); setParticles([]); setShockWaves([]); setTyped(""); }}
                  className={`px-6 py-3 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95 ${
                    dm ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  ❌ Quit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {gameStatus === "running" && (
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <p className={`text-sm font-medium ${dm ? "text-gray-500" : "text-gray-400"}`}>
            ⌨️ Type {mode === "word" ? "word" : "full phrase"} → <span className="font-bold text-amber-500">{mode === "word" ? "SPACE" : "final SPACE"}</span> to shoot 🏹
            &nbsp;•&nbsp; <span className="font-bold text-amber-500">ESC</span> to pause
          </p>
        </div>
      )}

      {/* Results Modal */}
      {gameStatus === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-lg rounded-3xl p-8 transition-all duration-500 animate-scale-in ${
              dm ? "bg-gray-900 border border-white/10 shadow-2xl" : "bg-white border border-gray-200 shadow-2xl"
            }`}
          >
            <h2
              className={`text-3xl font-black text-center mb-6 ${
                dm
                  ? "bg-gradient-to-r from-red-400 to-amber-300 bg-clip-text text-transparent"
                  : "bg-gradient-to-r from-red-600 to-amber-500 bg-clip-text text-transparent"
              }`}
            >
              🏹 Game Over!
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <GameResultCard dm={dm} label="Final Score" value={score.toString()} icon="🏆" />
              <GameResultCard dm={dm} label="Max Combo" value={`${maxCombo}x`} icon="🔥" />
              <GameResultCard dm={dm} label="Direct Hits" value={popped.toString()} icon="🎯" />
              <GameResultCard dm={dm} label="Missed" value={missed.toString()} icon="💨" />
              <GameResultCard dm={dm} label="Accuracy" value={popped + missed > 0 ? `${Math.round((popped / (popped + missed)) * 100)}%` : "0%"} icon="🏹" />
              <GameResultCard dm={dm} label="Duration" value={`${duration / 60} min`} icon="⏱️" />
            </div>
            <div className="text-center mb-6">
              <p className={`text-lg font-semibold ${dm ? "text-gray-300" : "text-gray-700"}`}>
                {score >= 3000 ? "🏆 Legendary Archer!" : score >= 2000 ? "🌟 Arrow Master!" : score >= 1000 ? "🔥 Great shooting!" : score >= 500 ? "👍 Good aim!" : "💪 Keep practicing!"}
              </p>
              {!isAuthenticated && (
                <p className={`mt-2 text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                  Login from Profile to store this game result.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={startGame} className="flex-1 py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-lg shadow-red-500/25">
                🔄 Play Again
              </button>
              <button
                onClick={() => { setGameStatus("idle"); setBubbles([]); setArrows([]); setParticles([]); setShockWaves([]); setTyped(""); }}
                className={`px-6 py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                  dm ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                🏠 Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */
function StatItem({ dm, label, value, warning, gradient, red }: { dm: boolean; label: string; value: string; warning?: boolean; gradient?: boolean; red?: boolean }) {
  let valueClass = dm ? "text-white" : "text-gray-800";
  if (warning) valueClass = "text-red-500 animate-pulse";
  if (gradient)
    valueClass = dm
      ? "bg-gradient-to-r from-red-400 to-amber-300 bg-clip-text text-transparent"
      : "bg-gradient-to-r from-red-600 to-amber-500 bg-clip-text text-transparent";
  if (red) valueClass = "text-red-500";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${dm ? "text-gray-500" : "text-gray-400"}`}>{label}</span>
      <span className={`text-xl sm:text-2xl font-black tabular-nums ${valueClass}`} style={{ fontFamily: "JetBrains Mono, monospace" }}>
        {value}
      </span>
    </div>
  );
}

function GameResultCard({ dm, label, value, icon }: { dm: boolean; label: string; value: string; icon: string }) {
  return (
    <div className={`p-4 rounded-2xl border transition-all ${dm ? "bg-gradient-to-br from-gray-800/80 to-gray-900 border-white/5" : "bg-gradient-to-br from-gray-50 to-white border-gray-200"}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-black mb-1 ${dm ? "text-white" : "text-gray-800"}`} style={{ fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
      <div className={`text-xs font-semibold ${dm ? "text-gray-400" : "text-gray-500"}`}>{label}</div>
    </div>
  );
}
