"use client"

import { useState, useEffect } from "react"

type Language = "en" | "pt"

export function useLanguage() {
  const [language, setLanguage] = useState<Language>("en")

  useEffect(() => {
    const stored = localStorage.getItem("language") as Language | null
    if (stored === "en" || stored === "pt") setLanguage(stored)
  }, [])

  function toggle() {
    const next: Language = language === "en" ? "pt" : "en"
    setLanguage(next)
    localStorage.setItem("language", next)
  }

  return { language, toggle }
}
