import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getWikipediaTextByWords,
  getRandomWikipediaParagraph,
  type TopicCategory,
} from "../data/texts";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";

type Status = "idle" | "running" | "finished";

const DURATIONS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "20 min", seconds: 1200 },
  { label: "30 min", seconds: 1800 },
];

export default function TypingTest() {
  const { settings } = useSettings();
  const { addPerformanceRecord, isAuthenticated } = useAuth();
  const dm = settings.darkMode;

  const [duration, setDuration] = useState(300);
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const [_errors, setErrors] = useState(0);
  const [_totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const paragraphInputRef = useRef<HTMLTextAreaElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appendCheckpointRef = useRef(0);
  const savedResultRef = useRef(false);

  const selectedCategories = useMemo(
    () =>
      Array.isArray(settings.topicCategories) && settings.topicCategories.length > 0
        ? (settings.topicCategories as TopicCategory[])
        : (["Science"] as TopicCategory[]),
    [settings.topicCategories]
  );

  const getAppendChunk = useCallback((minWords: number) => {
    const chunks: string[] = [];
    let words = 0;
    while (words < minWords) {
      const paragraph = getRandomWikipediaParagraph(selectedCategories);
      chunks.push(paragraph);
      words += paragraph.trim().split(/\s+/).length;
    }
    return chunks.join(" ");
  }, [selectedCategories]);

  const generateText = useCallback(() => {
    const targetWords = duration <= 300 ? 650 : duration <= 600 ? 1100 : duration <= 1200 ? 1800 : 2600;
    setText(getWikipediaTextByWords(targetWords, selectedCategories));
    appendCheckpointRef.current = 0;
  }, [duration, selectedCategories]);

  useEffect(() => {
    if (status === "running") return;
    generateText();
  }, [generateText, status]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  // Timer
  useEffect(() => {
    if (status === "running") {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setStatus("finished");
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (status === "finished") return;
    const value = e.target.value;

    if (status === "idle") {
      setStatus("running");
      setStartTime(Date.now());
    }

    setTotalKeystrokes((prev) => prev + 1);

    let errCount = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== text[i]) errCount++;
    }
    setErrors(errCount);
    setTyped(value);

    // Auto-scroll for inline mode
    if (settings.typingMode === "inline" && textDisplayRef.current) {
      const charElements = textDisplayRef.current.querySelectorAll("span[data-idx]");
      const currentChar = charElements[value.length];
      if (currentChar) {
        currentChar.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const reset = () => {
    setStatus("idle");
    setTyped("");
    setErrors(0);
    setTotalKeystrokes(0);
    setTimeLeft(duration);
    setStartTime(0);
    appendCheckpointRef.current = 0;
    savedResultRef.current = false;
    generateText();
    if (timerRef.current) clearInterval(timerRef.current);
    if (settings.typingMode === "paragraph") {
      paragraphInputRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  };

  const changeDuration = (sec: number) => {
    setDuration(sec);
    setTimeLeft(sec);
    setStatus("idle");
    setTyped("");
    setErrors(0);
    setTotalKeystrokes(0);
    setStartTime(0);
    appendCheckpointRef.current = 0;
    savedResultRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (status === "running") {
      savedResultRef.current = false;
    }
  }, [status]);

  // Long tests keep flowing: append fresh Wikipedia topics when near the end.
  useEffect(() => {
    if (status !== "running") return;
    if (duration < 1200) return;
    const remainingChars = text.length - typed.length;
    const advancedFromLastAppend = typed.length - appendCheckpointRef.current;

    if (remainingChars < 260 && advancedFromLastAppend > 220) {
      setText((prev) => `${prev} ${getAppendChunk(220)}`);
      appendCheckpointRef.current = typed.length;
    }
  }, [typed.length, text.length, status, duration, getAppendChunk]);

  // Stats
  const stats = useMemo(() => {
    const elapsed =
      status === "finished"
        ? duration
        : status === "running"
        ? (Date.now() - startTime) / 1000
        : 0;
    const minutes = elapsed / 60;
    const words = typed.trim().split(/\s+/).filter(Boolean).length;
    const wpm = minutes > 0 ? Math.round(words / minutes) : 0;

    let correctChars = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === text[i]) correctChars++;
    }
    const accuracy =
      typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100;
    const cpm = minutes > 0 ? Math.round(correctChars / minutes) : 0;

    return { wpm, accuracy, cpm, words, correctChars };
  }, [typed, status, startTime, duration, text]);

  useEffect(() => {
    if (status !== "finished") return;
    if (savedResultRef.current) return;

    addPerformanceRecord({
      type: "typing",
      duration,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      cpm: stats.cpm,
      words: stats.words,
    });

    savedResultRef.current = true;
  }, [addPerformanceRecord, duration, stats.accuracy, stats.cpm, stats.words, stats.wpm, status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((duration - timeLeft) / duration) * 100;

  // Split text into words for word-highlighting mode
  const textWords = useMemo(() => {
    const words: { word: string; startIdx: number }[] = [];
    let idx = 0;
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      words.push({ word: part, startIdx: idx });
      idx += part.length;
    }
    return words;
  }, [text]);

  // Find current word index
  const currentWordIdx = useMemo(() => {
    for (let i = textWords.length - 1; i >= 0; i--) {
      if (typed.length >= textWords[i].startIdx) return i;
    }
    return 0;
  }, [typed.length, textWords]);

  const fontStyle = {
    fontFamily: `${settings.fontFamily}, monospace`,
    fontSize: `${settings.fontSize}px`,
  };

  // Accent gradient
  const accentGrad = {
    violet: dm
      ? "from-violet-600 to-cyan-500"
      : "from-indigo-600 to-purple-500",
    blue: dm ? "from-blue-600 to-sky-400" : "from-blue-600 to-cyan-500",
    emerald: dm
      ? "from-emerald-600 to-teal-400"
      : "from-emerald-600 to-green-500",
    rose: dm ? "from-rose-600 to-pink-400" : "from-rose-600 to-pink-500",
    amber: dm
      ? "from-amber-600 to-yellow-400"
      : "from-amber-600 to-orange-500",
  }[settings.accentColor] || "from-violet-600 to-cyan-500";

  const accentText = {
    violet: dm ? "from-violet-400 to-cyan-300" : "from-indigo-600 to-purple-600",
    blue: dm ? "from-blue-400 to-sky-300" : "from-blue-600 to-cyan-600",
    emerald: dm ? "from-emerald-400 to-teal-300" : "from-emerald-600 to-green-600",
    rose: dm ? "from-rose-400 to-pink-300" : "from-rose-600 to-pink-600",
    amber: dm ? "from-amber-400 to-yellow-300" : "from-amber-600 to-orange-600",
  }[settings.accentColor] || "from-violet-400 to-cyan-300";

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Duration Selector */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {DURATIONS.map((d) => (
          <button
            key={d.seconds}
            onClick={() => changeDuration(d.seconds)}
            disabled={status === "running"}
            className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
              duration === d.seconds
                ? `bg-gradient-to-r ${accentGrad} text-white shadow-lg scale-105`
                : dm
                ? "bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700/50"
                : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 border border-gray-200 shadow-sm"
            } ${status === "running" ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p className={`text-center text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
        Active topics: {selectedCategories.join(", ")}
      </p>

      {/* Stats Bar */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-xl transition-all duration-500 ${
          dm
            ? "bg-gray-900/60 border border-white/5"
            : "bg-white/70 border border-gray-200/60 shadow-lg"
        }`}
      >
        <StatCell label="Time Left" dm={dm}>
          <span
            className={`text-xl sm:text-3xl font-black tabular-nums ${
              timeLeft <= 30 && status === "running"
                ? "text-red-500 animate-pulse"
                : dm ? "text-white" : "text-gray-800"
            }`}
            style={fontStyle}
          >
            {formatTime(timeLeft)}
          </span>
        </StatCell>
        <StatCell label="WPM" dm={dm}>
          <span
            className={`text-3xl font-black tabular-nums bg-gradient-to-r ${accentText} bg-clip-text text-transparent`}
            style={fontStyle}
          >
            {stats.wpm}
          </span>
        </StatCell>
        <StatCell label="Accuracy" dm={dm}>
          <span
            className={`text-3xl font-black tabular-nums ${
              stats.accuracy >= 95 ? "text-emerald-500" : stats.accuracy >= 80 ? "text-amber-500" : "text-red-500"
            }`}
            style={fontStyle}
          >
            {stats.accuracy}%
          </span>
        </StatCell>
        <StatCell label="CPM" dm={dm}>
          <span
            className={`text-3xl font-black tabular-nums ${dm ? "text-gray-300" : "text-gray-700"}`}
            style={fontStyle}
          >
            {stats.cpm}
          </span>
        </StatCell>
      </div>

      {/* Progress Bar */}
      <div className={`h-1.5 rounded-full overflow-hidden ${dm ? "bg-gray-800" : "bg-gray-200"}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear bg-gradient-to-r ${accentGrad}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* =========== INLINE MODE =========== */}
      {settings.typingMode === "inline" && (
        <div
          className={`relative rounded-2xl p-6 sm:p-8 backdrop-blur-xl transition-all duration-500 cursor-text overflow-hidden ${
            dm
              ? "bg-gray-900/70 border border-white/5 shadow-2xl"
              : "bg-white/90 border border-gray-200/50 shadow-xl"
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {/* Hidden textarea */}
          <textarea
            ref={inputRef}
            value={typed}
            onChange={handleInput}
            disabled={status === "finished"}
            className="absolute opacity-0 w-0 h-0"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />

          {/* Rendered text - with optional word highlighting */}
          <div
            ref={textDisplayRef}
            className="leading-relaxed max-h-[320px] overflow-y-auto pr-2"
            style={{ ...fontStyle, wordBreak: "break-all" }}
          >
            {settings.highlightWords
              ? /* ---- WORD HIGHLIGHTING MODE ---- */
                textWords.map((tw, wi) => {
                  const isCurrent = wi === currentWordIdx;
                  const chars = tw.word.split("").map((char, ci) => {
                    const globalIdx = tw.startIdx + ci;
                    let cls = "";
                    if (globalIdx < typed.length) {
                      cls = typed[globalIdx] === char
                        ? dm ? "text-emerald-400" : "text-emerald-600"
                        : dm ? "text-red-400 bg-red-900/40" : "text-red-500 bg-red-100";
                    } else if (globalIdx === typed.length) {
                      cls = cursorVisible
                        ? dm ? "border-l-2 border-cyan-400 bg-cyan-400/10" : "border-l-2 border-indigo-500 bg-indigo-100/50"
                        : "";
                      cls += dm ? " text-gray-400" : " text-gray-500";
                    } else {
                      cls = dm ? "text-gray-600" : "text-gray-400";
                    }
                    return (
                      <span key={globalIdx} data-idx={globalIdx} className={`${cls} transition-colors duration-100`}>
                        {char}
                      </span>
                    );
                  });

                  return (
                    <span
                      key={wi}
                      className={`${
                        isCurrent && status === "running"
                          ? dm
                            ? "bg-violet-900/30 rounded px-0.5 ring-1 ring-violet-500/30"
                            : "bg-indigo-100/60 rounded px-0.5 ring-1 ring-indigo-300/50"
                          : ""
                      } transition-all duration-200`}
                    >
                      {chars}
                    </span>
                  );
                })
              : /* ---- CHARACTER MODE (no word highlight) ---- */
                text.split("").map((char, i) => {
                  let className = "";
                  if (i < typed.length) {
                    className = typed[i] === char
                      ? dm ? "text-emerald-400" : "text-emerald-600"
                      : dm ? "text-red-400 bg-red-900/40" : "text-red-500 bg-red-100";
                  } else if (i === typed.length) {
                    className = cursorVisible
                      ? dm ? "border-l-2 border-cyan-400 bg-cyan-400/10" : "border-l-2 border-indigo-500 bg-indigo-100/50"
                      : "";
                    className += dm ? " text-gray-400" : " text-gray-500";
                  } else {
                    className = dm ? "text-gray-600" : "text-gray-400";
                  }
                  return (
                    <span key={i} data-idx={i} className={`${className} transition-colors duration-100`}>
                      {char}
                    </span>
                  );
                })}
          </div>

          {/* Idle overlay */}
          {status === "idle" && typed.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[2px] rounded-2xl">
              <div
                className={`text-center px-6 py-4 rounded-2xl transition-all ${
                  dm ? "bg-gray-900/90 border border-white/10" : "bg-white/95 border border-gray-200 shadow-lg"
                }`}
              >
                <p className={`text-2xl mb-2 ${dm ? "text-white" : "text-gray-800"}`}>
                  👆 Click here & start typing
                </p>
                <p className={`text-sm ${dm ? "text-gray-400" : "text-gray-500"}`}>
                  Timer starts when you begin typing
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========== PARAGRAPH / TEXT BOX MODE =========== */}
      {settings.typingMode === "paragraph" && (
        <div className="flex flex-col gap-4">
          {/* Reference text (top) */}
          <div
            className={`relative rounded-2xl p-5 sm:p-6 backdrop-blur-xl transition-all duration-500 overflow-hidden ${
              dm
                ? "bg-gray-900/70 border border-white/5 shadow-2xl"
                : "bg-white/90 border border-gray-200/50 shadow-xl"
            }`}
          >
            <div className={`flex items-center gap-2 mb-3 ${dm ? "text-gray-500" : "text-gray-400"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Reference Text</span>
            </div>
            <div
              ref={textDisplayRef}
              className="leading-relaxed max-h-[200px] overflow-y-auto pr-2"
              style={fontStyle}
            >
              {settings.highlightWords
                ? textWords.map((tw, wi) => {
                    const isCurrent = wi === currentWordIdx;
                    const isTyped = tw.startIdx + tw.word.length <= typed.length;
                    const isPartial = !isTyped && tw.startIdx < typed.length;

                    // Check word correctness
                    let wordCorrect = true;
                    if (isTyped) {
                      for (let c = 0; c < tw.word.length; c++) {
                        if (typed[tw.startIdx + c] !== tw.word[c]) {
                          wordCorrect = false;
                          break;
                        }
                      }
                    }

                    let wordCls = dm ? "text-gray-600" : "text-gray-400";
                    if (isTyped) {
                      wordCls = wordCorrect
                        ? dm ? "text-emerald-400" : "text-emerald-600"
                        : dm ? "text-red-400" : "text-red-500";
                    }

                    return (
                      <span
                        key={wi}
                        className={`${wordCls} transition-all duration-200 ${
                          isCurrent && status === "running"
                            ? dm
                              ? "bg-violet-900/40 rounded px-0.5 ring-1 ring-violet-500/40 text-white"
                              : "bg-indigo-100/70 rounded px-0.5 ring-1 ring-indigo-300/60 text-gray-800"
                            : ""
                        }`}
                      >
                        {isPartial
                          ? tw.word.split("").map((char, ci) => {
                              const gIdx = tw.startIdx + ci;
                              if (gIdx < typed.length) {
                                return (
                                  <span
                                    key={ci}
                                    className={
                                      typed[gIdx] === char
                                        ? dm ? "text-emerald-400" : "text-emerald-600"
                                        : dm ? "text-red-400 bg-red-900/40" : "text-red-500 bg-red-100"
                                    }
                                  >
                                    {char}
                                  </span>
                                );
                              }
                              return (
                                <span key={ci} className={isCurrent && gIdx === typed.length && cursorVisible
                                  ? dm ? "border-l-2 border-cyan-400" : "border-l-2 border-indigo-500"
                                  : ""
                                }>
                                  {char}
                                </span>
                              );
                            })
                          : tw.word}
                      </span>
                    );
                  })
                : text.split("").map((char, i) => {
                    let cls = dm ? "text-gray-600" : "text-gray-400";
                    if (i < typed.length) {
                      cls = typed[i] === char
                        ? dm ? "text-emerald-400" : "text-emerald-600"
                        : dm ? "text-red-400 bg-red-900/40" : "text-red-500 bg-red-100";
                    } else if (i === typed.length && cursorVisible) {
                      cls += dm ? " border-l-2 border-cyan-400" : " border-l-2 border-indigo-500";
                    }
                    return <span key={i}>{char}</span>;
                  })}
            </div>
          </div>

          {/* User typing area (bottom) */}
          <div
            className={`relative rounded-2xl transition-all duration-500 overflow-hidden ${
              dm
                ? "bg-gray-900/70 border border-white/5 shadow-2xl"
                : "bg-white/90 border border-gray-200/50 shadow-xl"
            }`}
          >
            <div className={`flex items-center gap-2 px-5 pt-4 ${dm ? "text-gray-500" : "text-gray-400"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider">Type Here</span>
            </div>
            <textarea
              ref={paragraphInputRef}
              value={typed}
              onChange={handleInput}
              disabled={status === "finished"}
              placeholder={status === "idle" ? "Start typing here... timer begins on first keystroke" : ""}
              className={`w-full px-5 py-4 bg-transparent outline-none resize-none leading-relaxed ${
                dm
                  ? "text-white placeholder-gray-600"
                  : "text-gray-800 placeholder-gray-400"
              }`}
              style={{ ...fontStyle, minHeight: "140px" }}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={reset}
          className={`px-8 py-3 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 active:scale-95 bg-gradient-to-r ${accentGrad} text-white shadow-lg`}
        >
          🔄 Restart Test
        </button>
      </div>

      {/* Results Modal */}
      {status === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-lg rounded-3xl p-8 transition-all duration-500 animate-scale-in ${
              dm
                ? "bg-gray-900 border border-white/10 shadow-2xl"
                : "bg-white border border-gray-200 shadow-2xl"
            }`}
          >
            <h2
              className={`text-3xl font-black text-center mb-6 bg-gradient-to-r ${accentText} bg-clip-text text-transparent`}
            >
              🎉 Test Complete!
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <ResultCard dm={dm} label="Words Per Minute" value={stats.wpm.toString()} icon="⚡" color="violet" />
              <ResultCard dm={dm} label="Accuracy" value={`${stats.accuracy}%`} icon="🎯" color="emerald" />
              <ResultCard dm={dm} label="Characters / Min" value={stats.cpm.toString()} icon="📝" color="amber" />
              <ResultCard dm={dm} label="Total Words" value={stats.words.toString()} icon="📊" color="cyan" />
            </div>

            <div className="text-center mb-6">
              <p className={`text-lg font-semibold ${dm ? "text-gray-300" : "text-gray-700"}`}>
                {stats.wpm >= 80
                  ? "🏆 Outstanding! You're a typing master!"
                  : stats.wpm >= 60
                  ? "🌟 Great job! Above average speed!"
                  : stats.wpm >= 40
                  ? "👍 Good work! Keep practicing!"
                  : "💪 Keep going! Practice makes perfect!"}
              </p>
              {!isAuthenticated && (
                <p className={`mt-2 text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>
                  Login from Profile to save this result to your performance chart.
                </p>
              )}
            </div>

            <button
              onClick={reset}
              className={`w-full py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r ${accentGrad} text-white shadow-lg`}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StatCell({ label, dm, children }: { label: string; dm: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-semibold uppercase tracking-wider ${dm ? "text-gray-500" : "text-gray-400"}`}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ResultCard({ dm, label, value, icon, color }: { dm: boolean; label: string; value: string; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    violet: dm ? "from-violet-600/20 to-violet-500/5 border-violet-500/20" : "from-violet-50 to-white border-violet-200",
    emerald: dm ? "from-emerald-600/20 to-emerald-500/5 border-emerald-500/20" : "from-emerald-50 to-white border-emerald-200",
    amber: dm ? "from-amber-600/20 to-amber-500/5 border-amber-500/20" : "from-amber-50 to-white border-amber-200",
    cyan: dm ? "from-cyan-600/20 to-cyan-500/5 border-cyan-500/20" : "from-cyan-50 to-white border-cyan-200",
  };
  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br border transition-all ${colorMap[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-black mb-1 ${dm ? "text-white" : "text-gray-800"}`} style={{ fontFamily: "JetBrains Mono, monospace" }}>
        {value}
      </div>
      <div className={`text-xs font-semibold ${dm ? "text-gray-400" : "text-gray-500"}`}>{label}</div>
    </div>
  );
}
