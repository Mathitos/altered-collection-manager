"use client"

import { useLanguage } from "@/hooks/use-language"
import { Button } from "@/components/ui/button"

export function LanguageToggle() {
  const { language, toggle } = useLanguage()
  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      {language === "en" ? "PT" : "EN"}
    </Button>
  )
}
