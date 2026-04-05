import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { validateDeck, type DeckCardEntry } from "@/lib/deck-validation"
import { AlertTriangleIcon, CheckCircleIcon } from "lucide-react"
import type { Card, UniqueCard } from "@/generated/prisma/client"

const FACTION_LABELS: Record<string, string> = {
  AX: "Axiom", BR: "Bravos", LY: "Lyra", MU: "Muna", OR: "Ordis", YZ: "Yzmir",
}

const RARITY_LABELS: Record<string, string> = {
  C: "Common", R: "Rare", F: "Faction-shifted", E: "Exalted", U: "Unique",
}

type Variant = { variantId: string; language: string; imageUrl: string; artist: string; isCollectorArt: boolean }

export default async function PublicDeckPage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const { shareToken } = await params

  const deck = await prisma.deck.findUnique({
    where: { shareToken },
    include: {
      heroCard: true,
      cards: { include: { card: true, uniqueCard: true } },
    },
  })

  if (!deck || !deck.isPublic) notFound()

  const deckCardEntries: DeckCardEntry[] = deck.cards.map((dc) => ({
    cardId: dc.cardId,
    uniqueCardId: dc.uniqueCardId,
    quantity: dc.quantity,
    card: dc.card,
    uniqueCard: dc.uniqueCard,
  }))

  const validation = validateDeck(deck.heroCard, deckCardEntries)

  // Group cards by type
  const grouped = deckCardEntries.reduce<Record<string, DeckCardEntry[]>>((acc, dc) => {
    const type = dc.card?.type ?? dc.uniqueCard?.type ?? "Unknown"
    if (!acc[type]) acc[type] = []
    acc[type].push(dc)
    return acc
  }, {})

  function getCardImage(card: Card | UniqueCard | null): string | null {
    if (!card) return null
    const variants = card.variants as Variant[] | null
    return variants?.find((v) => !v.isCollectorArt)?.imageUrl ?? variants?.[0]?.imageUrl ?? null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{deck.name}</h1>
        {deck.description && (
          <p className="text-muted-foreground mt-1">{deck.description}</p>
        )}

        {/* Hero */}
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-3">
          {getCardImage(deck.heroCard) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getCardImage(deck.heroCard)!}
              alt={deck.heroCard.name}
              className="h-16 w-11 rounded object-cover"
            />
          )}
          <div>
            <p className="text-xs text-muted-foreground">Herói</p>
            <p className="font-semibold">{deck.heroCard.name}</p>
            <Badge variant="outline" className="mt-1 text-xs">
              {FACTION_LABELS[deck.heroCard.faction] ?? deck.heroCard.faction}
            </Badge>
          </div>
        </div>
      </div>

      {/* Validation */}
      <div className={`mb-6 rounded-lg border p-3 ${validation.valid ? "border-green-600/30 bg-green-950/20" : "border-yellow-600/30 bg-yellow-950/20"}`}>
        <div className="flex items-center gap-2 mb-1">
          {validation.valid
            ? <CheckCircleIcon className="size-4 text-green-500" />
            : <AlertTriangleIcon className="size-4 text-yellow-500" />}
          <span className="text-sm font-medium">
            {validation.valid ? "Deck válido (Standard)" : "Deck inválido"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex gap-3">
          <span>{validation.stats.total} cartas</span>
          <span>{validation.stats.rares} Rares</span>
          <span>{validation.stats.uniques} Uniques</span>
        </div>
        {validation.errors.map((e) => (
          <p key={e.rule} className="text-xs text-yellow-400 mt-1">{e.message}</p>
        ))}
      </div>

      {/* Card list grouped by type */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([type, entries]) => (
          <div key={type}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {type} ({entries.reduce((s, e) => s + e.quantity, 0)})
            </h2>
            <div className="divide-y divide-border rounded-lg border border-border">
              {entries.map((dc) => {
                const card = dc.card ?? dc.uniqueCard
                if (!card) return null
                const img = getCardImage(card)
                return (
                  <div key={dc.cardId ?? dc.uniqueCardId} className="flex items-center gap-3 p-2">
                    <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-muted">
                      {img && <img src={img} alt={card.name} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {RARITY_LABELS[card.rarity] ?? card.rarity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground shrink-0">×{dc.quantity}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
