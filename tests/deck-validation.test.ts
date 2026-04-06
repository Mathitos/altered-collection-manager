import { describe, it, expect } from "bun:test"
import { validateDeck } from "../src/lib/deck-validation"
import type { Card } from "../src/generated/prisma/client"

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    name: "Test Card",
    faction: "AX",
    type: "Permanent",
    rarity: "C",
    mainEffect: null,
    echoEffect: null,
    forestPower: null,
    mountainPower: null,
    waterPower: null,
    cost: null,
    reserve: null,
    permanentAtk: null,
    permanentDef: null,
    setCode: "CORE",
    variants: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeHero(faction = "AX"): Card {
  return makeCard({ id: "hero-1", name: "Hero", type: "Hero", faction, rarity: "C" })
}

function makeDeckCards(count: number, overrides: Partial<Card> = {}) {
  return Array.from({ length: count }, (_, i) => ({
    cardId: `card-${i}`,
    quantity: 1,
    card: makeCard({ id: `card-${i}`, name: `Card ${i}`, ...overrides }),
  }))
}

describe("validateDeck", () => {
  it("returns error when no hero", () => {
    const result = validateDeck(null, makeDeckCards(39))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.rule === "heroRequired")).toBe(true)
  })

  it("returns error when fewer than 39 cards", () => {
    const result = validateDeck(makeHero(), makeDeckCards(38))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.rule === "minCards")).toBe(true)
  })

  it("passes with exactly 39 cards", () => {
    const result = validateDeck(makeHero(), makeDeckCards(39))
    expect(result.errors.some((e) => e.rule === "minCards")).toBe(false)
  })

  it("returns error when more than 3 copies of same name", () => {
    const cards = makeDeckCards(39)
    // override first 4 to have same name
    for (let i = 0; i < 4; i++) {
      cards[i] = { cardId: `card-${i}`, quantity: 1, card: makeCard({ id: `card-${i}`, name: "Duplicated" }) }
    }
    const result = validateDeck(makeHero(), cards)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.rule === "maxCopiesPerName")).toBe(true)
  })

  it("allows up to 3 copies of same name", () => {
    const cards = makeDeckCards(39)
    for (let i = 0; i < 3; i++) {
      cards[i] = { cardId: `card-${i}`, quantity: 1, card: makeCard({ id: `card-${i}`, name: "Duplicated" }) }
    }
    const result = validateDeck(makeHero(), cards)
    expect(result.errors.some((e) => e.rule === "maxCopiesPerName")).toBe(false)
  })

  it("returns error for wrong faction cards", () => {
    const cards = makeDeckCards(38)
    cards.push({ cardId: "wrong", quantity: 1, card: makeCard({ id: "wrong", faction: "BR" }) })
    const result = validateDeck(makeHero("AX"), cards)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.rule === "monoFaction")).toBe(true)
  })

  it("returns error when more than 15 Rares", () => {
    const cards = makeDeckCards(23)
    const rares = Array.from({ length: 16 }, (_, i) => ({
      cardId: `rare-${i}`,
      quantity: 1,
      card: makeCard({ id: `rare-${i}`, name: `Rare ${i}`, rarity: "R" }),
    }))
    const result = validateDeck(makeHero(), [...cards, ...rares])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.rule === "maxRares")).toBe(true)
  })

  it("allows up to 15 Rares", () => {
    const cards = makeDeckCards(24)
    const rares = Array.from({ length: 15 }, (_, i) => ({
      cardId: `rare-${i}`,
      quantity: 1,
      card: makeCard({ id: `rare-${i}`, name: `Rare ${i}`, rarity: "R" }),
    }))
    const result = validateDeck(makeHero(), [...cards, ...rares])
    expect(result.errors.some((e) => e.rule === "maxRares")).toBe(false)
  })

  it("returns error when more than 3 Uniques", () => {
    const cards = makeDeckCards(36)
    const uniques = Array.from({ length: 4 }, (_, i) => ({
      uniqueCardId: `unique-${i}`,
      quantity: 1,
      uniqueCard: { ...makeCard({ id: `unique-${i}`, name: `Unique ${i}`, rarity: "U" }) },
    }))
    const result = validateDeck(makeHero(), [...cards, ...uniques])
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.rule === "maxUniques")).toBe(true)
  })

  it("counts stats correctly", () => {
    const commons = makeDeckCards(24)
    const rares = Array.from({ length: 15 }, (_, i) => ({
      cardId: `rare-${i}`,
      quantity: 1,
      card: makeCard({ id: `rare-${i}`, name: `Rare ${i}`, rarity: "R" }),
    }))
    const result = validateDeck(makeHero(), [...commons, ...rares])
    expect(result.stats.total).toBe(39)
    expect(result.stats.rares).toBe(15)
    expect(result.stats.uniques).toBe(0)
  })

  it("valid deck passes all rules", () => {
    const result = validateDeck(makeHero(), makeDeckCards(39))
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
