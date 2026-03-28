import { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { TOPIC_CATEGORIES, type TopicCategory } from "../data/texts";

const FONT_OPTIONS = [
  { label: "JetBrains Mono", value: "JetBrains Mono" },
  { label: "System Default", value: "Inter" },
  { label: "Courier New", value: "Courier New" },
  { label: "Consolas", value: "Consolas" },
];

const ACCENT_COLORS = [
  { label: "Violet", value: "violet", bg: "bg-violet-500" },
  { label: "Blue", value: "blue", bg: "bg-blue-500" },
  { label: "Emerald", value: "emerald", bg: "bg-emerald-500" },
  { label: "Rose", value: "rose", bg: "bg-rose-500" },
  { label: "Amber", value: "amber", bg: "bg-amber-500" },
];

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Save Settings");
  const { settings, updateSetting, saveSettings, resetSettings } = useSettings();
  const dm = settings.darkMode;

  const handleSave = () => {
    saveSettings();
    setSaveLabel("Saved");
    setTimeout(() => setSaveLabel("Save Settings"), 1400);
  };

  return (
    <>
      {/* Settings Gear Button */}
      <button
        onClick={() => setOpen(true)}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group ${
          dm
            ? "bg-gray-800/80 border border-gray-700/50 hover:border-violet-500/50 hover:bg-gray-700/80"
            : "bg-white/80 border border-gray-200 hover:border-indigo-300 hover:bg-gray-50 shadow-sm"
        }`}
        title="Settings"
      >
        <svg
          className={`w-5 h-5 transition-all duration-500 group-hover:rotate-90 ${
            dm ? "text-gray-400 group-hover:text-violet-400" : "text-gray-500 group-hover:text-indigo-600"
          }`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          style={{ animation: "fade-in 0.2s ease-out" }}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-[101] h-dvh w-full max-w-md transition-transform duration-500 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div
          className={`h-dvh overflow-y-auto overscroll-contain px-6 py-6 pb-24 ${
            dm
              ? "bg-gray-900/98 border-l border-white/10"
              : "bg-white/98 border-l border-gray-200"
          }`}
          style={{ backdropFilter: "blur(20px)" }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 -mx-6 px-6 pb-5 mb-6 pt-1 backdrop-blur-xl bg-inherit border-b border-dashed border-white/10">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                dm ? "bg-violet-600/20 text-violet-400" : "bg-indigo-100 text-indigo-600"
              }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-xl font-black ${dm ? "text-white" : "text-gray-800"}`}>Settings</h2>
                <p className={`text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>Customize your experience</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${
                dm ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-800"
              }`}
            >
              ✕
            </button>
            </div>
          </div>

          {/* APPEARANCE */}
          <SectionTitle text="🎨 Appearance" dm={dm} />

          {/* Dark Mode */}
          <SettingRow label="Dark Mode" dm={dm}>
            <ToggleSwitch
              checked={settings.darkMode}
              onChange={(v) => updateSetting("darkMode", v)}
              dm={dm}
            />
          </SettingRow>

          {/* Accent Color */}
          <SettingRow label="Accent Color" dm={dm}>
            <div className="flex gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => updateSetting("accentColor", c.value)}
                  className={`w-7 h-7 rounded-full transition-all duration-200 ${c.bg} ${
                    settings.accentColor === c.value
                      ? "ring-2 ring-offset-2 scale-110 " + (dm ? "ring-white ring-offset-gray-900" : "ring-gray-800 ring-offset-white")
                      : "opacity-60 hover:opacity-100 hover:scale-105"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </SettingRow>

          {/* Animated Background */}
          <SettingRow label="Animated Background" dm={dm}>
            <ToggleSwitch
              checked={settings.showBackground}
              onChange={(v) => updateSetting("showBackground", v)}
              dm={dm}
            />
          </SettingRow>

          {/* TYPOGRAPHY */}
          <SectionTitle text="📝 Typography" dm={dm} />

          {/* Font Family */}
          <SettingRow label="Font Family" dm={dm}>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSetting("fontFamily", e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all outline-none cursor-pointer ${
                dm
                  ? "bg-gray-800 text-white border border-gray-700"
                  : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </SettingRow>

          {/* Font Size */}
          <SettingRow label={`Text Size: ${settings.fontSize}px`} dm={dm}>
            <input
              type="range"
              min={12}
              max={30}
              value={settings.fontSize}
              onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
              className="w-32 accent-violet-500"
            />
          </SettingRow>

          {/* TYPING TEST */}
          <SectionTitle text="⌨️ Typing Test" dm={dm} />

          {/* Typing Mode */}
          <SettingRow label="Input Mode" dm={dm}>
            <div className={`flex gap-1 p-0.5 rounded-lg ${dm ? "bg-gray-800" : "bg-gray-100"}`}>
              <MiniTab
                active={settings.typingMode === "inline"}
                label="Inline"
                onClick={() => updateSetting("typingMode", "inline")}
                dm={dm}
              />
              <MiniTab
                active={settings.typingMode === "paragraph"}
                label="Text Box"
                onClick={() => updateSetting("typingMode", "paragraph")}
                dm={dm}
              />
            </div>
          </SettingRow>

          {/* Word Highlighting */}
          <SettingRow label="Highlight Words" dm={dm}>
            <ToggleSwitch
              checked={settings.highlightWords}
              onChange={(v) => updateSetting("highlightWords", v)}
              dm={dm}
            />
          </SettingRow>

          {/* Topic Category Selector */}
          <div className={`py-3 border-b ${dm ? "border-gray-800/60" : "border-gray-100"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${dm ? "text-gray-300" : "text-gray-700"}`}>
                Topic Categories
              </span>
              <button
                onClick={() => updateSetting("topicCategories", [...TOPIC_CATEGORIES])}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors ${
                  dm ? "text-violet-300 hover:bg-violet-500/15" : "text-indigo-600 hover:bg-indigo-50"
                }`}
              >
                Select all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPIC_CATEGORIES.map((category) => {
                const active = settings.topicCategories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => {
                      if (active && settings.topicCategories.length === 1) return;
                      const next = active
                        ? settings.topicCategories.filter((item) => item !== category)
                        : [...settings.topicCategories, category];
                      updateSetting("topicCategories", next as TopicCategory[]);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                      active
                        ? dm
                          ? "bg-violet-600/25 text-violet-200 border-violet-500/40"
                          : "bg-indigo-100 text-indigo-700 border-indigo-300"
                        : dm
                        ? "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200"
                        : "bg-white text-gray-500 border-gray-200 hover:text-gray-700"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
            <p className={`mt-2 text-xs ${dm ? "text-gray-500" : "text-gray-400"}`}>
              Pick one or more categories for typing practice.
            </p>
          </div>

          {/* ARROW GAME */}
          <SectionTitle text="🏹 Arrow Game" dm={dm} />

          {/* Bubble Size */}
          <SettingRow label={`Bubble Size: ${(settings.bubbleSize * 100).toFixed(0)}%`} dm={dm}>
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={settings.bubbleSize * 100}
              onChange={(e) => updateSetting("bubbleSize", Number(e.target.value) / 100)}
              className="w-32 accent-red-500"
            />
          </SettingRow>

          {/* Bubble Text Size */}
          <SettingRow label={`Bubble Text: ${(settings.bubbleTextScale * 100).toFixed(0)}%`} dm={dm}>
            <input
              type="range"
              min={80}
              max={160}
              step={5}
              value={settings.bubbleTextScale * 100}
              onChange={(e) => updateSetting("bubbleTextScale", Number(e.target.value) / 100)}
              className="w-32 accent-red-500"
            />
          </SettingRow>

          {/* Max Bubbles */}
          <SettingRow label={`Bubbles on Screen: ${settings.maxBubbles}`} dm={dm}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting("maxBubbles", Math.max(1, settings.maxBubbles - 1))}
                className={`w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center transition-all hover:scale-110 ${
                  dm ? "bg-gray-800 text-white border border-gray-700" : "bg-gray-100 text-gray-800 border border-gray-200"
                }`}
              >−</button>
              <span className={`w-6 text-center font-black text-lg ${dm ? "text-white" : "text-gray-800"}`}>
                {settings.maxBubbles}
              </span>
              <button
                onClick={() => updateSetting("maxBubbles", Math.min(8, settings.maxBubbles + 1))}
                className={`w-8 h-8 rounded-lg font-bold text-lg flex items-center justify-center transition-all hover:scale-110 ${
                  dm ? "bg-gray-800 text-white border border-gray-700" : "bg-gray-100 text-gray-800 border border-gray-200"
                }`}
              >+</button>
            </div>
          </SettingRow>

          {/* Sound */}
          <SettingRow label="Sound Effects" dm={dm}>
            <ToggleSwitch
              checked={settings.soundEnabled}
              onChange={(v) => updateSetting("soundEnabled", v)}
              dm={dm}
            />
          </SettingRow>

          {/* MOTION */}
          <SectionTitle text="✨ Motion" dm={dm} />
          <SettingRow label="Animation Style" dm={dm}>
            <select
              value={settings.animationStyle}
              onChange={(e) => updateSetting("animationStyle", e.target.value as "float" | "pulse" | "orbit" | "minimal")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all outline-none cursor-pointer ${
                dm
                  ? "bg-gray-800 text-white border border-gray-700"
                  : "bg-gray-100 text-gray-800 border border-gray-200"
              }`}
            >
              <option value="float">Float</option>
              <option value="pulse">Pulse</option>
              <option value="orbit">Orbit</option>
              <option value="minimal">Minimal</option>
            </select>
          </SettingRow>

          {/* Reset */}
          <div className="mt-8 pt-6 border-t border-dashed" style={{ borderColor: dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
            <button
              onClick={handleSave}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] mb-3 ${
                dm
                  ? "bg-violet-600/30 text-violet-300 border border-violet-500/30 hover:bg-violet-600/40"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
              }`}
            >
              💾 {saveLabel}
            </button>
            <button
              onClick={() => { resetSettings(); }}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                dm
                  ? "bg-red-900/30 text-red-400 border border-red-800/40 hover:bg-red-900/50"
                  : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              }`}
            >
              🔄 Reset All Settings
            </button>
          </div>

          {/* Preview */}
          <div className={`mt-6 p-4 rounded-xl ${dm ? "bg-gray-800/50 border border-gray-700/30" : "bg-gray-50 border border-gray-200"}`}>
            <p className={`text-xs font-semibold mb-2 ${dm ? "text-gray-500" : "text-gray-400"}`}>PREVIEW</p>
            <p
              style={{
                fontFamily: `${settings.fontFamily}, monospace`,
                fontSize: `${settings.fontSize}px`,
              }}
              className={dm ? "text-gray-300" : "text-gray-700"}
            >
              The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Sub-components ---------- */

function SectionTitle({ text, dm }: { text: string; dm: boolean }) {
  return (
    <h3 className={`text-sm font-black uppercase tracking-wider mt-7 mb-3 ${dm ? "text-gray-400" : "text-gray-600"}`}>
      {text}
    </h3>
  );
}

function SettingRow({ label, dm, children }: { label: string; dm: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between py-3 border-b ${dm ? "border-gray-800/60" : "border-gray-100"}`}>
      <span className={`text-sm font-medium ${dm ? "text-gray-300" : "text-gray-700"}`}>{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, dm }: { checked: boolean; onChange: (v: boolean) => void; dm: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
        checked
          ? dm ? "bg-violet-600" : "bg-indigo-600"
          : dm ? "bg-gray-700" : "bg-gray-300"
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
          checked ? "left-[26px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function MiniTab({ active, label, onClick, dm }: { active: boolean; label: string; onClick: () => void; dm: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
        active
          ? dm ? "bg-violet-600 text-white shadow" : "bg-indigo-600 text-white shadow"
          : dm ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </button>
  );
}
