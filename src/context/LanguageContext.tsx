import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { messages, SupportedLanguage, defaultLanguage } from "../i18n/messages";

type LanguageContextValue = {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "likesense_language";

function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined") return defaultLanguage;
  const nav = navigator.language || (navigator.languages && navigator.languages[0]) || "";
  return nav.toLowerCase().startsWith("en") ? "en" : "it";
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(defaultLanguage);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
    if (stored === "en" || stored === "it") {
      setLanguageState(stored);
    } else {
      setLanguageState(detectBrowserLanguage());
    }
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  };

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string) => {
      const dict = messages[language] ?? messages[defaultLanguage];
      return dict[key] ?? messages[defaultLanguage][key] ?? key;
    };
    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
