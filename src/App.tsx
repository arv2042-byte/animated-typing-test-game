import { useState } from "react";
import Header from "./components/Header";
import TypingTest from "./components/TypingTest";
import ArrowGame from "./components/ArrowGame";
import AnimatedBubbles from "./components/AnimatedBubbles";
import { useSettings } from "./context/SettingsContext";

type TabType = "typing" | "arrows";

const heroContent: Record<TabType, { title: string; subtitle: string }> = {
  typing: {
    title: "Test Your Typing Speed",
    subtitle:
      "Challenge yourself with timed typing tests. Track your WPM, accuracy, and improve with practice.",
  },
  arrows: {
    title: "Arrow Attack! 🏹",
    subtitle:
      "Type words & press SPACE to shoot arrows at falling bubbles! Build combos, earn points, master the bow!",
  },
};

export default function App() {
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("typing");
  const { settings } = useSettings();
  const dm = settings.darkMode;

  const { title, subtitle } = heroContent[activeTab];

  const accentGrad = {
    violet: dm
      ? "from-violet-400 via-cyan-300 to-violet-400"
      : "from-indigo-700 via-purple-600 to-indigo-700",
    blue: dm
      ? "from-blue-400 via-sky-300 to-blue-400"
      : "from-blue-700 via-cyan-600 to-blue-700",
    emerald: dm
      ? "from-emerald-400 via-teal-300 to-emerald-400"
      : "from-emerald-700 via-green-600 to-emerald-700",
    rose: dm
      ? "from-rose-400 via-pink-300 to-rose-400"
      : "from-rose-700 via-pink-600 to-rose-700",
    amber: dm
      ? "from-amber-400 via-yellow-300 to-amber-400"
      : "from-amber-700 via-orange-600 to-amber-700",
  }[settings.accentColor] || "from-violet-400 via-cyan-300 to-violet-400";

  return (
    <div
        className={`min-h-screen transition-all duration-700 relative ${
        dm
          ? "bg-gray-950 text-white"
          : "bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 text-gray-900"
      }`}
      style={{ fontFamily: `${settings.fontFamily}, sans-serif` }}
    >
      {/* Animated Background */}
      {settings.showBackground && (
        <AnimatedBubbles darkMode={dm} animationStyle={settings.animationStyle} />
      )}

      {/* Gradient overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-700 ${
          dm ? "opacity-100" : "opacity-40"
        }`}
        style={{
          background:
            activeTab === "arrows"
              ? "radial-gradient(ellipse at 20% 20%, rgba(255, 80, 50, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(255, 180, 0, 0.05) 0%, transparent 50%)"
              : "radial-gradient(ellipse at 20% 20%, rgba(120, 80, 255, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(0, 200, 255, 0.06) 0%, transparent 50%)",
        }}
      />

      {/* Light mode subtle pattern */}
      {!dm && (
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      )}

      {!entered ? (
        <main className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8 sm:py-10">
          <div
            className={`w-full max-w-3xl rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center backdrop-blur-xl ${
              dm
                ? "bg-gray-900/70 border border-white/10"
                : "bg-white/85 border border-gray-200 shadow-xl"
            }`}
          >
            <h1 className={`text-3xl sm:text-6xl font-black mb-3 sm:mb-4 bg-gradient-to-r ${accentGrad} bg-clip-text text-transparent`}>
              TypeFlow
            </h1>
            <p className={`${dm ? "text-gray-300" : "text-gray-600"} max-w-xl mx-auto mb-6`}>
              Start with paragraph typing or jump into arrow attack. Customize bubble count, sizes, theme, and input style from settings.
            </p>
            <div className={`text-sm mb-7 ${dm ? "text-gray-400" : "text-gray-500"}`}>
              5/10/20/30 minute tests • Word highlight mode • Arrow game with phrase + SPACE attack
            </div>
            <button
              onClick={() => setEntered(true)}
              className={`px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${accentGrad} shadow-lg hover:scale-105 transition-transform`}
            >
              Enter Website
            </button>
          </div>
        </main>
      ) : (
        <>
          {/* Header */}
          <Header activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Content */}
          <main className="relative z-10 pb-8">
        {/* Hero Section */}
        <div className="text-center py-6 sm:py-8 px-4">
          <h2
            className={`text-2xl sm:text-4xl md:text-5xl font-black mb-2 sm:mb-3 transition-all duration-500 bg-gradient-to-r ${
              activeTab === "arrows"
                ? dm
                  ? "from-red-400 via-amber-300 to-red-400"
                  : "from-red-700 via-orange-600 to-red-700"
                : accentGrad
            } bg-clip-text text-transparent`}
            style={{
              backgroundSize: "200% auto",
              animation:
                settings.animationStyle === "minimal"
                  ? "none"
                  : settings.animationStyle === "pulse"
                  ? "pulse-glow 2.2s ease-in-out infinite alternate"
                  : "gradient-shift 4s linear infinite",
            }}
          >
            {title}
          </h2>
          <p
            className={`text-base sm:text-lg max-w-xl mx-auto transition-colors duration-500 ${
              dm ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {subtitle}
          </p>
        </div>

        {/* Active Component */}
        <div
          className="transition-all duration-500"
          style={{ animation: "fade-slide-up 0.5s ease-out" }}
          key={activeTab}
        >
          {activeTab === "typing" ? <TypingTest /> : <ArrowGame />}
        </div>
          </main>

          {/* Footer */}
          <footer
            className={`relative z-10 text-center py-6 border-t transition-all duration-500 ${
              dm
                ? "border-white/5 text-gray-600"
                : "border-gray-200/60 text-gray-400"
            }`}
          >
            <p className="text-sm font-medium">
              Built with ❤️ •{" "}
              <span
                className={`font-bold bg-gradient-to-r ${accentGrad} bg-clip-text text-transparent`}
              >
                TypeFlow
              </span>{" "}
              © 2025
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
