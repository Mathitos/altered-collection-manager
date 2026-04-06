/**
 * Import Altered TCG cards from the official API
 * Usage: bun run scripts/import-altered-api.ts [--locale en-us|fr-fr|es-es|de-de] [--dry-run]
 *
 * Fetches all cards from api.altered.gg and upserts them into the local database.
 * R1/R2 variants of the same card are merged into one Card record with multiple variants.
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { writeFileSync } from "fs"
import { join } from "path"

const BASE_URL = "https://api.altered.gg"
const DEFAULT_LOCALE = "en-us"
const PAGE_SIZE = 36

const args = process.argv.slice(2)
const localeArg = args.find((a) => a.startsWith("--locale="))
const locale = localeArg ? localeArg.split("=")[1] : DEFAULT_LOCALE
const dryRun = args.includes("--dry-run")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// ── Types from the Altered API ─────────────────────────────────────────────

type AlteredCard = {
  reference: string
  name: string
  cardType?: { reference: string; name: string }
  mainFaction?: { reference: string; name: string }
  rarity?: { reference: string; name: string }
  cardSet?: { reference: string; name: string }
  cardFamilyReference?: string
  elements?: Record<string, string>
  allImagePath?: Record<string, string>
  imagePath?: string
}

type ApiResponse = {
  "hydra:member": AlteredCard[]
  "hydra:totalItems": number
  "hydra:view"?: { "hydra:next"?: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Map API rarity reference to our DB rarity code */
function mapRarity(ref: string): string {
  const map: Record<string, string> = {
    COMMON: "C",
    RARE: "R",
    UNIQUE: "U",
    EXALTED: "E",
    COMMON_FOIL: "F",
    RARE_FOIL: "R",
  }
  return map[ref.toUpperCase()] ?? "C"
}

/** Map API type reference to readable type string */
function mapType(ref: string): string {
  const map: Record<string, string> = {
    CHARACTER: "Character",
    PERMANENT: "Permanent",
    SPELL: "Spell",
    TOKEN: "Token",
    FOILER: "Foiler",
    HERO: "Hero",
    EXPEDITION_PERK: "Expedition Perk",
  }
  return map[ref.toUpperCase()] ?? ref.charAt(0).toUpperCase() + ref.slice(1).toLowerCase()
}

/** Extract collection code and card number from cardFamilyReference like "AX_106" */
function parseFamily(setCode: string, familyRef: string): { setCode: string; collectionNumber: number } {
  // familyRef like "AX_106" → number 106
  const match = familyRef.match(/(\d+)$/)
  const collectionNumber = match ? parseInt(match[1]) : Math.abs(hashCode(familyRef)) % 100000
  return { setCode, collectionNumber }
}

/** Set code from card reference like "ALT_EOLECB_A_AX_106_C" → "ALT_EOLECB" */
function extractSetCode(reference: string): string {
  const parts = reference.split("_")
  return parts.slice(0, 2).join("_")
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return hash
}

/** Get best image URL for a card */
function getImageUrl(card: AlteredCard): string | null {
  if (card.allImagePath) {
    return card.allImagePath[locale] ?? card.allImagePath["en-us"] ?? null
  }
  return card.imagePath ?? null
}

/** Group key for merging R1/R2 variants: "setCode|collectionNumber|rarityCode" */
function groupKey(setCode: string, collectionNumber: number, rarityCode: string): string {
  return `${setCode}|${collectionNumber}|${rarityCode}`
}

// ── API Fetching ───────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<ApiResponse> {
  const res = await fetch(url, {
    headers: { Accept: "application/ld+json", "Accept-Language": locale },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchCardSets(): Promise<{ reference: string; name: string }[]> {
  const res = await fetch(`${BASE_URL}/card_sets?itemsPerPage=100&locale=${locale}`, {
    headers: { Accept: "application/ld+json" },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data["hydra:member"] ?? []
}

async function fetchCardsForSet(setRef: string): Promise<AlteredCard[]> {
  const cards: AlteredCard[] = []
  let url: string | undefined =
    `${BASE_URL}/cards?itemsPerPage=${PAGE_SIZE}&locale=${locale}&cardSet[]=${setRef}`

  while (url) {
    const data = await fetchPage(url)
    cards.push(...data["hydra:member"])
    const next = data["hydra:view"]?.["hydra:next"]
    url = next ? `${BASE_URL}${next}` : undefined
    if (url) await new Promise((r) => setTimeout(r, 200))
  }

  return cards
}

async function fetchAllCards(): Promise<AlteredCard[]> {
  const sets = await fetchCardSets()
  console.log(`Found ${sets.length} card sets: ${sets.map((s) => s.reference).join(", ")}\n`)

  const all: AlteredCard[] = []
  const seen = new Set<string>()

  for (const set of sets) {
    process.stdout.write(`  Fetching set ${set.reference} (${set.name})...`)
    const cards = await fetchCardsForSet(set.reference)
    let newCards = 0
    for (const card of cards) {
      if (!seen.has(card.reference)) {
        seen.add(card.reference)
        all.push(card)
        newCards++
      }
    }
    console.log(` ${newCards} new cards (${all.length} total)`)
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`\nDone fetching: ${all.length} unique cards across all sets.`)
  return all
}

// ── Group & merge variants ─────────────────────────────────────────────────

type CardGroup = {
  setCode: string
  collectionNumber: number
  name: string
  faction: string
  type: string
  rarityCode: string
  mainCost: number | null
  recallCost: number | null
  forestPower: number | null
  mountainPower: number | null
  oceanPower: number | null
  variants: { variantId: string; language: string; imageUrl: string; isCollectorArt: boolean }[]
  isUnique: boolean
}

type SkippedReason = "missing_cardType" | "missing_faction" | "missing_rarity" | "missing_familyRef"

type SkippedEntry = {
  reference: string
  name: string
  reason: SkippedReason
  cardType?: string
  faction?: string
  rarity?: string
  cardFamilyReference?: string
}

function groupCards(cards: AlteredCard[]): { groups: Map<string, CardGroup>; skipped: SkippedEntry[] } {
  const groups = new Map<string, CardGroup>()
  const skipped: SkippedEntry[] = []

  for (const card of cards) {
    if (!card.cardType?.reference) {
      skipped.push({ reference: card.reference, name: card.name, reason: "missing_cardType", faction: card.mainFaction?.reference, rarity: card.rarity?.reference, cardFamilyReference: card.cardFamilyReference })
      continue
    }
    if (!card.mainFaction?.reference) {
      skipped.push({ reference: card.reference, name: card.name, reason: "missing_faction", cardType: card.cardType.reference, rarity: card.rarity?.reference, cardFamilyReference: card.cardFamilyReference })
      continue
    }
    if (!card.rarity?.reference) {
      skipped.push({ reference: card.reference, name: card.name, reason: "missing_rarity", cardType: card.cardType.reference, faction: card.mainFaction.reference, cardFamilyReference: card.cardFamilyReference })
      continue
    }
    if (!card.cardFamilyReference) {
      skipped.push({ reference: card.reference, name: card.name, reason: "missing_familyRef", cardType: card.cardType.reference, faction: card.mainFaction.reference, rarity: card.rarity.reference })
      continue
    }

    const rarityCode = mapRarity(card.rarity.reference)
    const setCode = extractSetCode(card.reference)
    const { collectionNumber } = parseFamily(setCode, card.cardFamilyReference)
    const key = groupKey(setCode, collectionNumber, rarityCode)

    const imageUrl = getImageUrl(card)

    if (!groups.has(key)) {
      const el = card.elements ?? {}
      groups.set(key, {
        setCode,
        collectionNumber,
        name: card.name,
        faction: card.mainFaction.reference,
        type: mapType(card.cardType.reference),
        rarityCode,
        mainCost: el.MAIN_COST ? parseInt(el.MAIN_COST) : null,
        recallCost: el.RECALL_COST ? parseInt(el.RECALL_COST) : null,
        forestPower: el.FOREST_POWER != null ? parseInt(el.FOREST_POWER) : null,
        mountainPower: el.MOUNTAIN_POWER != null ? parseInt(el.MOUNTAIN_POWER) : null,
        oceanPower: el.OCEAN_POWER != null ? parseInt(el.OCEAN_POWER) : null,
        variants: [],
        isUnique: rarityCode === "U",
      })
    }

    const group = groups.get(key)!

    // Update name if the current one looks like a reference (contains underscores)
    if (group.name.includes("_") && !card.name.includes("_")) {
      group.name = card.name
    }

    // Add variant if we have an image
    if (imageUrl && !group.variants.some((v) => v.imageUrl === imageUrl)) {
      // Determine if collector art by checking reference suffix
      const refSuffix = card.reference.split("_").pop() ?? ""
      const isCollectorArt = refSuffix === "R2"
      group.variants.push({
        variantId: card.reference,
        language: locale.split("-")[0],
        imageUrl,
        isCollectorArt,
      })
    }
  }

  return { groups, skipped }
}

// ── Upsert to DB ───────────────────────────────────────────────────────────

async function upsertGroup(group: CardGroup): Promise<void> {
  const common = {
    name: group.name,
    faction: group.faction,
    type: group.type,
    mainCost: group.mainCost,
    recallCost: group.recallCost,
    forestPower: group.forestPower,
    mountainPower: group.mountainPower,
    oceanPower: group.oceanPower,
    ...(group.variants.length > 0 && { variants: group.variants }),
  }

  if (group.isUnique) {
    const uniqueId = Math.abs(hashCode(`${group.setCode}_${group.collectionNumber}`)) % 1000000
    await prisma.uniqueCard.upsert({
      where: {
        collection_collectionNumber_uniqueId: {
          collection: group.setCode,
          collectionNumber: group.collectionNumber,
          uniqueId,
        },
      },
      update: { rarity: "U", ...common },
      create: { collection: group.setCode, collectionNumber: group.collectionNumber, uniqueId, rarity: "U", ...common },
    })
  } else {
    await prisma.card.upsert({
      where: {
        collection_collectionNumber_rarity: {
          collection: group.setCode,
          collectionNumber: group.collectionNumber,
          rarity: group.rarityCode,
        },
      },
      update: common,
      create: { collection: group.setCode, collectionNumber: group.collectionNumber, rarity: group.rarityCode, ...common },
    })
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Altered TCG Card Importer`)
  console.log(`Locale: ${locale}${dryRun ? " | DRY RUN" : ""}`)
  console.log("─".repeat(50))

  const cards = await fetchAllCards()
  const { groups, skipped } = groupCards(cards)

  console.log(`Grouped into ${groups.size} unique card entries.`)
  console.log(`Skipped: ${skipped.length} cards missing required fields.\n`)

  // Save skipped cards to file for analysis
  if (skipped.length > 0) {
    const skippedPath = join(import.meta.dir, `skipped-cards-${locale}-${Date.now()}.json`)
    const byReason = skipped.reduce<Record<string, SkippedEntry[]>>((acc, s) => {
      acc[s.reason] = acc[s.reason] ?? []
      acc[s.reason].push(s)
      return acc
    }, {})
    writeFileSync(skippedPath, JSON.stringify({ total: skipped.length, byReason, entries: skipped }, null, 2))
    console.log(`  Skipped cards saved to: ${skippedPath}\n`)
  }

  if (dryRun) {
    console.log("Dry run — no DB writes.")
    return
  }

  let imported = 0
  let errors = 0

  for (const group of groups.values()) {
    try {
      await upsertGroup(group)
      imported++
      if (imported % 50 === 0) {
        process.stdout.write(`\r  Progress: ${imported}/${groups.size}`)
      }
    } catch (err) {
      errors++
      console.error(`\n  Error: "${group.name}" (${group.setCode} #${group.collectionNumber} ${group.rarityCode}): ${err}`)
    }
  }

  console.log(`\n\nDone!`)
  console.log(`  Imported: ${imported}`)
  console.log(`  Skipped:  ${skipped.length} (see skipped-cards-*.json)`)
  console.log(`  Errors:   ${errors}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
