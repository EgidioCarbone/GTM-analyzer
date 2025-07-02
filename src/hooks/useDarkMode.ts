import { useEffect, useState } from "react";

/** Hook che gestisce la preferenza Dark/Light e la salva in localStorage */
export default function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("theme");
    return stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return [isDark, setIsDark] as const;
}