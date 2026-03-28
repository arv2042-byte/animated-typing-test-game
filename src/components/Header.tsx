import Logo from "./Logo";
import SettingsPanel from "./SettingsPanel";
import ProfilePanel from "./ProfilePanel";
import { useSettings } from "../context/SettingsContext";

interface Props {
  activeTab: "typing" | "arrows";
  setActiveTab: (tab: "typing" | "arrows") => void;
}

const tabs = [
  { key: "typing" as const, label: "⌨️ Typing Test" },
  { key: "arrows" as const, label: "🏹 Arrow Attack" },
];

export default function Header({ activeTab, setActiveTab }: Props) {
  const { settings, updateSetting } = useSettings();
  const dm = settings.darkMode;

  return (
    <header
      className={`relative z-20 px-4 sm:px-8 py-3 sm:py-4 flex flex-col lg:flex-row items-center justify-between gap-4 border-b backdrop-blur-xl transition-all duration-500 ${
        dm
          ? "border-white/5 bg-gray-950/60"
          : "border-gray-200/50 bg-white/70 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between w-full lg:w-auto gap-4">
        <Logo darkMode={dm} />
        <div className="flex lg:hidden items-center gap-2">
          <ProfilePanel />
          <SettingsPanel />
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className={`flex items-center gap-1 p-1 rounded-xl backdrop-blur-sm w-full sm:w-auto justify-center ${
        dm ? "bg-white/5" : "bg-gray-900/5"
      }`}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[10px] xs:text-xs sm:text-sm font-semibold transition-all duration-300 ${
              activeTab === tab.key
                ? tab.key === "arrows"
                  ? "bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg shadow-red-500/25"
                  : dm
                  ? "bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/25"
                  : "bg-gradient-to-r from-indigo-600 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                : dm
                ? "text-gray-400 hover:text-white hover:bg-white/5"
                : "text-gray-500 hover:text-gray-800 hover:bg-black/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right controls */}
      <div className="hidden lg:flex items-center gap-3">
        <ProfilePanel />

        {/* Dark Mode Toggle */}
        <button
          onClick={() => updateSetting("darkMode", !dm)}
          className={`relative w-16 h-8 rounded-full p-1 transition-all duration-500 focus:outline-none ${
            dm
              ? "bg-gradient-to-r from-indigo-800 to-violet-900 shadow-inner"
              : "bg-gradient-to-r from-amber-200 to-yellow-300 shadow-inner"
          }`}
          aria-label="Toggle dark mode"
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-500 shadow-lg ${
              dm
                ? "translate-x-8 bg-indigo-500 rotate-180"
                : "translate-x-0 bg-yellow-400 rotate-0"
            }`}
          >
            {dm ? "🌙" : "☀️"}
          </div>
        </button>

        {/* Settings Gear */}
        <SettingsPanel />
      </div>
    </header>
  );
}
