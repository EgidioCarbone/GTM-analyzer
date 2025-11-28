import React from "react";
import { useLanguage } from "../context/LanguageContext";

const btnBase =
  "px-3 py-1 text-sm font-semibold transition rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-purple-200";

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-2 bg-white/70 backdrop-blur border border-white/50 rounded-full shadow-sm px-1">
      <button
        type="button"
        aria-label={`${t("lang.switch.label")} IT`}
        onClick={() => setLanguage("it")}
        className={`${btnBase} ${language === "it" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" : "text-slate-700 hover:bg-white"}`}
      >
        {t("common.language.it")}
      </button>
      <button
        type="button"
        aria-label={`${t("lang.switch.label")} EN`}
        onClick={() => setLanguage("en")}
        className={`${btnBase} ${language === "en" ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white" : "text-slate-700 hover:bg-white"}`}
      >
        {t("common.language.en")}
      </button>
    </div>
  );
};
