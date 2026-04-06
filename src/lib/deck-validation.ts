import type { Card, UniqueCard } from "@/generated/prisma/client"

export type DeckCardEntry = {
  cardId?: string | null
  uniqueCardId?: string | null
  quantity: number
  card?: Card | null
  uniqueCard?: UniqueCard | null
}

export type ValidationError = {
  rule: string
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
  stats: {
    total: number
    rares: number
    uniques: number
  }
}

const MAX_COPIES_PER_NAME = 3
const MIN_CARDS = 39
const MAX_RARES = 15
const MAX_UNIQUES = 3

export function validateDeck(
  heroCard: Card | null | undefined,
  deckCards: DeckCardEntry[]
): ValidationResult {
  const errors: ValidationError[] = []

  const nonUniqueCards = deckCards.filter((dc) => dc.card)
  const uniqueCards = deckCards.filter((dc) => dc.uniqueCard)

  const total =
    nonUniqueCards.reduce((sum, dc) => sum + dc.quantity, 0) +
    uniqueCards.reduce((sum, dc) => sum + dc.quantity, 0)

  const rares = nonUniqueCards
    .filter((dc) => dc.card?.rarity === "R" || dc.card?.rarity === "F")
    .reduce((sum, dc) => sum + dc.quantity, 0)

  const uniques = uniqueCards.reduce((sum, dc) => sum + dc.quantity, 0)

  // Rule: Hero required
  if (!heroCard) {
    errors.push({ rule: "heroRequired", message: "O deck precisa de um Herói." })
  }

  // Rule: Min 39 cards (excluding hero)
  if (total < MIN_CARDS) {
    errors.push({
      rule: "minCards",
      message: `Mínimo de ${MIN_CARDS} cartas (excluindo Herói). Faltam ${MIN_CARDS - total}.`,
    })
  }

  // Rule: Max 3 copies per card name (all rarities combined)
  const nameCount: Record<string, number> = {}
  for (const dc of nonUniqueCards) {
    if (!dc.card) continue
    const name = dc.card.name.toLowerCase()
    nameCount[name] = (nameCount[name] ?? 0) + dc.quantity
  }
  for (const [name, count] of Object.entries(nameCount)) {
    if (count > MAX_COPIES_PER_NAME) {
      errors.push({
        rule: "maxCopiesPerName",
        message: `"${name}" tem ${count} cópias (máximo ${MAX_COPIES_PER_NAME}).`,
      })
    }
  }

  // Rule: Mono-faction
  if (heroCard) {
    const heroFaction = heroCard.faction
    const wrongFaction = nonUniqueCards.filter(
      (dc) => dc.card && dc.card.type !== "Hero" && dc.card.faction !== heroFaction
    )
    const wrongUniqueFaction = uniqueCards.filter(
      (dc) => dc.uniqueCard && dc.uniqueCard.faction !== heroFaction
    )
    if (wrongFaction.length > 0 || wrongUniqueFaction.length > 0) {
      errors.push({
        rule: "monoFaction",
        message: `Todas as cartas devem ser da fação ${heroFaction} (fação do Herói).`,
      })
    }
  }

  // Rule: Max 15 Rares
  if (rares > MAX_RARES) {
    errors.push({
      rule: "maxRares",
      message: `Máximo de ${MAX_RARES} Rares. Deck tem ${rares}.`,
    })
  }

  // Rule: Max 3 Uniques
  if (uniques > MAX_UNIQUES) {
    errors.push({
      rule: "maxUniques",
      message: `Máximo de ${MAX_UNIQUES} cartas Unique. Deck tem ${uniques}.`,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: { total, rares, uniques },
  }
}
