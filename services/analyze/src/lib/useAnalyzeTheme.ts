"use client";

import { useEffect, useState } from "react";

export type AnalyzeTheme = "dark" | "light";
export const ANALYZE_THEME_STORAGE_KEY = "bozkurt-analyze-theme";

function storedTheme(): AnalyzeTheme | null {
  try {
    const value = window.localStorage.getItem(ANALYZE_THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function preferredTheme(): AnalyzeTheme {
  return storedTheme() ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme: AnalyzeTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useAnalyzeTheme() {
  const [theme, setTheme] = useState<AnalyzeTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const next = preferredTheme();
      applyTheme(next);
      setTheme(next);
    };
    const onSystemChange = () => {
      if (!storedTheme()) syncTheme();
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === ANALYZE_THEME_STORAGE_KEY || event.key === null) syncTheme();
    };

    syncTheme();
    setReady(true);
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  function chooseTheme(next: AnalyzeTheme) {
    try {
      window.localStorage.setItem(ANALYZE_THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage; keep the selected theme for this page.
    }
    applyTheme(next);
    setTheme(next);
  }

  return { theme, ready, chooseTheme };
}
