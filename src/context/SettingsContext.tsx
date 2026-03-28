import { createContext, useContext, useState, type ReactNode } from "react";
import { TOPIC_CATEGORIES, type TopicCategory } from "../data/texts";

export interface Settings {
  darkMode: boolean;
  fontSize: number;       // 14-28
  bubbleSize: number;     // 0.5-2.0 multiplier
  bubbleTextScale: number; // 0.8-1.6 multiplier
  maxBubbles: number;     // 1-8
  fontFamily: string;
  showBackground: boolean;
  soundEnabled: boolean;
  typingMode: "inline" | "paragraph"; // inline = overlay, paragraph = separate text box
  highlightWords: boolean;
  accentColor: string;    // "violet" | "blue" | "emerald" | "rose" | "amber"
  animationStyle: "float" | "pulse" | "orbit" | "minimal";
  topicCategories: TopicCategory[];
}

const defaultSettings: Settings = {
  darkMode: true,
  fontSize: 18,
  bubbleSize: 1.0,
  bubbleTextScale: 1.0,
  maxBubbles: 1,
  fontFamily: "JetBrains Mono",
  showBackground: true,
  soundEnabled: true,
  typingMode: "inline",
  highlightWords: true,
  accentColor: "violet",
  animationStyle: "float",
  topicCategories: [...TOPIC_CATEGORIES],
};

const createDefaultSettings = (): Settings => ({
  ...defaultSettings,
  topicCategories: [...TOPIC_CATEGORIES],
});

const normalizeSettings = (raw: unknown): Settings => {
  const base = createDefaultSettings();
  if (!raw || typeof raw !== "object") return base;

  const candidate = raw as Partial<Settings>;
  const categories = Array.isArray(candidate.topicCategories)
    ? candidate.topicCategories.filter((item): item is TopicCategory =>
        TOPIC_CATEGORIES.includes(item as TopicCategory)
      )
    : base.topicCategories;

  return {
    ...base,
    ...candidate,
    topicCategories: categories.length > 0 ? categories : [...TOPIC_CATEGORIES],
  };
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveSettings: () => void;
  resetSettings: () => void;
  applyMobileOptimizations: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: createDefaultSettings(),
  updateSetting: () => {},
  saveSettings: () => {},
  resetSettings: () => {},
  applyMobileOptimizations: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem("typeflow-settings");
      if (saved) return normalizeSettings(JSON.parse(saved));
    } catch { /* ignore */ }
    return createDefaultSettings();
  });

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const applyMobileOptimizations = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setSettings((prev) => ({
        ...prev,
        fontSize: Math.min(prev.fontSize, 16),
        bubbleSize: Math.min(prev.bubbleSize, 0.8),
        maxBubbles: Math.min(prev.maxBubbles, 3),
        typingMode: "paragraph", // Better for mobile keyboards
      }));
    }
  };

  const saveSettings = () => {
    try {
      localStorage.setItem("typeflow-settings", JSON.stringify(settings));
    } catch {
      // ignore localStorage failures
    }
  };

  const resetSettings = () => {
    setSettings(createDefaultSettings());
    try { localStorage.removeItem("typeflow-settings"); } catch { /* ignore */ }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, saveSettings, resetSettings, applyMobileOptimizations }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
