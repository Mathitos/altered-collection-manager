"use client"

import { useLanguage } from "@/hooks/use-language"
import { LanguageToggle } from "@/components/cards/language-toggle"
import { Badge } from "@/components/ui/badge"
import type { Card } from "@/generated/prisma/client"
import { useState } from "react"

const FACTION_LABELS: Record<string, string> = {
  AX: "Axiom",
  BR: "Bravos",
  LY: "Lyra",
  MU: "Muna",
  OR: "Ordis",
  YZ: "Yzmir",
}

const RARITY_LABELS: Record<string, string> = {
  C: "Common",
  R: "Rare",
  F: "Faction-shifted",
  E: "Exalted",
  U: "Unique",
}

type Variant = {
  variantId: string
  language: string
  imageUrl: string
  artist: string
  isCollectorArt: boolean
}

type Translations = {
  [lang: string]: {
    name?: string
    abilityText?: string
    supportText?: string
    flavorText?: string
  }
}

export function CardDetail({ card }: { card: Card }) {
  const { language } = useLanguage()
  const variants = (card.variants as Variant[]) ?? []
  const translations = (card.translations as Translations) ?? {}
  const t = translations[language] ?? {}

  const mainVariant =
    variants.find((v) => v.language === "en" && !v.isCollectorArt) ?? variants[0]
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    mainVariant ?? null
  )

  const name = language === "pt" ? (t.name ?? card.name) : card.name
  const abilityText = language === "pt" ? (t.abilityText ?? card.abilityText) : card.abilityText
  const supportText = language === "pt" ? (t.supportText ?? card.supportText) : card.supportText
  const flavorText = language === "pt" ? (t.flavorText ?? card.flavorText) : card.flavorText

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-end mb-4">
        <LanguageToggle />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Image */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-muted aspect-[5/7]">
            {selectedVariant?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedVariant.imageUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
          </div>

          {/* Variants */}
          {variants.length > 1 && (
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">Variantes</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.variantId}
                    onClick={() => setSelectedVariant(v)}
                    className={`overflow-hidden rounded border-2 transition-all w-14 h-20 ${
                      selectedVariant?.variantId === v.variantId
                        ? "border-primary"
                        : "border-transparent"
                    }`}
                  >
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.imageUrl} alt={v.language} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full bg-muted flex items-center justify-center text-xs">
                        {v.language}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedVariant && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Artista: {selectedVariant.artist}
                  {selectedVariant.isCollectorArt && " · Collector Art"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{FACTION_LABELS[card.faction] ?? card.faction}</Badge>
              <Badge variant="outline">{card.type}</Badge>
              <Badge variant="secondary">{RARITY_LABELS[card.rarity] ?? card.rarity}</Badge>
              <Badge variant="outline">{card.collection}-{card.collectionNumber}</Badge>
            </div>
          </div>

          {/* Costs & Powers */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4">
            {card.mainCost !== null && card.mainCost !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Main Cost</p>
                <p className="font-semibold">{card.mainCost}</p>
              </div>
            )}
            {card.recallCost !== null && card.recallCost !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Recall Cost</p>
                <p className="font-semibold">{card.recallCost}</p>
              </div>
            )}
            {card.forestPower !== null && card.forestPower !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Forest</p>
                <p className="font-semibold">{card.forestPower}</p>
              </div>
            )}
            {card.mountainPower !== null && card.mountainPower !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Mountain</p>
                <p className="font-semibold">{card.mountainPower}</p>
              </div>
            )}
            {card.oceanPower !== null && card.oceanPower !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Ocean</p>
                <p className="font-semibold">{card.oceanPower}</p>
              </div>
            )}
          </div>

          {/* Texts */}
          {abilityText && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Ability</p>
              <p className="text-sm">{abilityText}</p>
            </div>
          )}
          {supportText && (
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Support</p>
              <p className="text-sm">{supportText}</p>
            </div>
          )}
          {flavorText && (
            <p className="text-sm italic text-muted-foreground">"{flavorText}"</p>
          )}
        </div>
      </div>
    </div>
  )
}
