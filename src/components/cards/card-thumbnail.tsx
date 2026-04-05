import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { Card } from "@/generated/prisma/client"

const FACTION_LABELS: Record<string, string> = {
  AX: "Axiom",
  BR: "Bravos",
  LY: "Lyra",
  MU: "Muna",
  OR: "Ordis",
  YZ: "Yzmir",
}

const RARITY_COLORS: Record<string, string> = {
  C: "bg-gray-500",
  R: "bg-yellow-600",
  F: "bg-purple-600",
  E: "bg-blue-600",
  U: "bg-orange-600",
}

type Variant = {
  variantId: string
  language: string
  imageUrl: string
  artist: string
  isCollectorArt: boolean
}

function getMainVariant(card: Card): Variant | null {
  const variants = card.variants as Variant[] | null
  if (!variants || variants.length === 0) return null
  return variants.find((v) => v.language === "en" && !v.isCollectorArt) ?? variants[0]
}

export function CardThumbnail({ card }: { card: Card }) {
  const variant = getMainVariant(card)

  return (
    <Link href={`/cards/${card.id}`} className="group block">
      <div className="relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary hover:shadow-md">
        {/* Card Image */}
        <div className="aspect-[5/7] w-full bg-muted">
          {variant?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={variant.imageUrl}
              alt={card.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
        </div>

        {/* Card Info */}
        <div className="p-3">
          <p className="truncate font-medium text-sm">{card.name}</p>
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {FACTION_LABELS[card.faction] ?? card.faction}
            </Badge>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {card.type}
            </Badge>
            <span
              className={`ml-auto inline-block rounded px-1.5 py-0 text-xs text-white ${RARITY_COLORS[card.rarity] ?? "bg-gray-500"}`}
            >
              {card.rarity}
            </span>
          </div>
          {card.mainCost !== null && card.mainCost !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">Cost: {card.mainCost}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
