/**
 * Import Altered TCG cards from the official API
 *
 * Usage:
 *   bun run import:cards                        # fetch from API, save cache, import
 *   bun run import:cards --dry-run              # fetch from API, save cache, no DB writes
 *   bun run import:cards --from-cache=<file>    # load from cached JSON, import (no API call)
 *   bun run import:cards --from-cache=<file> --dry-run
 *
 * The raw API response is always saved to scripts/cache/api-cards-TIMESTAMP.json on the
 * first fetch. Use --from-cache to re-import from that file without hitting the API again.
 *
 * Only imports cards from main collections (CORE, ALIZE, BISE, CYCLONE, DUSTER, EOLE)
 * with card type "B" (base). Alternate art (A), promos (P) and non-main sets are
 * saved to a file for later review.
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { writeFileSync, readFileSync, mkdirSync } from "fs"
import { join } from "path"

const BASE_URL = "https://api.altered.gg"
const LOCALE = "en-us"
const PAGE_SIZE = 108

const MAIN_COLLECTIONS = new Set(["CORE", "ALIZE", "BISE", "CYCLONE", "DUSTER", "EOLE"])
const MAIN_CARD_TYPE = "B"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const fromCacheArg = args.find((a) => a.startsWith("--from-cache="))
const fromCacheFile = fromCacheArg ? fromCacheArg.split("=")[1] : null

const CACHE_DIR = join(import.meta.dir, "cache")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// ── Types ──────────────────────────────────────────────────────────────────

type AlteredCard = {
  reference: string
  name: string
  cardType?: { reference: string; name: string }
  cardSet?: { reference: string; name: string }
  mainFaction?: { reference: string; name: string }
  rarity?: { reference: string; name: string }
  cardFamilyReference?: string
  elements?: Record<string, string>
  allImagePath?: Record<string, string>
  imagePath?: string
  [key: string]: unknown
}

type ApiResponse = {
  "hydra:member": AlteredCard[]
  "hydra:totalItems": number
  "hydra:view"?: { "hydra:next"?: string }
}

/** Parsed fields extracted directly from the reference string */
type ParsedRef = {
  collection: string
  cardVariantType: string  // B=base, P=promo, A=alternate art
  faction: string
  collectionNumber: number
  rarity: string           // C, R1, R2, E, U
  uniqueId: number | null
  isUnique: boolean
}

type SkippedCard = {
  reference: string
  name: string
  reason: string
  raw: AlteredCard
}

// ── Reference parser ───────────────────────────────────────────────────────

/**
 * Parse the reference string into structured fields.
 *
 * Format: ALT_{COLLECTION}_{CARD_VARIANT_TYPE}_{FACTION}_{NUMBER}_{RARITY}
 * Unique:  ALT_{COLLECTION}_{CARD_VARIANT_TYPE}_{FACTION}_{NUMBER}_U_{UNIQUE_ID}
 *
 * CARD_VARIANT_TYPE values:
 *   B = Base card. The canonical version. Only this type is imported into the DB.
 *
 *   A = Alternate art. Same card characteristics (stats, effects, rules) as the
 *       base (B) version, but with a different artwork and image URI.
 *       For our business rules, treated identically to a promo — skipped during
 *       import and saved to file for later review/linking.
 *
 *   P = Promo card. Also shares all characteristics with the base (B) version,
 *       differing only in artwork. Same treatment as A: skipped and saved to file.
 *
 * Examples:
 *   ALT_ALIZE_B_AX_32_C       → collection=ALIZE, type=B, faction=AX, num=32, rarity=C  ✅ imported
 *   ALT_ALIZE_B_AX_32_R1      → rarity=R1                                                ✅ imported
 *   ALT_ALIZE_B_AX_32_R2      → rarity=R2                                                ✅ imported
 *   ALT_ALIZE_B_AX_32_U_19302 → rarity=U, uniqueId=19302                                 ✅ imported
 *   ALT_ALIZE_A_AX_32_C       → type=A (alternate art, different image URI)              ⏭ skipped
 *   ALT_DUSTERTOP_P_AX_32_R1  → type=P (promo, different image URI)                     ⏭ skipped
 */
function parseReference(ref: string): ParsedRef | null {
  const parts = ref.split("_")
  // Minimum: ALT + COLLECTION + TYPE + FACTION + NUMBER + RARITY = 6 parts
  if (parts.length < 6 || parts[0] !== "ALT") return null

  const collection = parts[1]
  const cardVariantType = parts[2]
  const faction = parts[3]
  const collectionNumber = parseInt(parts[4])

  if (isNaN(collectionNumber)) return null

  const raritySuffix = parts[5]

  if (raritySuffix === "U") {
    // Unique: ALT_ALIZE_B_AX_32_U_19302
    const uniqueId = parts[6] ? parseInt(parts[6]) : null
    if (!uniqueId) return null
    return { collection, cardVariantType, faction, collectionNumber, rarity: "U", uniqueId, isUnique: true }
  }

  // Rarity mapping from reference suffix to DB rarity code:
  //   C  → C  (Common)
  //   R1 → R  (Rare — standard rare art)
  //   R2 → F  (Faction-shifted — alternate rare art, same card as R1 with different image)
  //   E  → E  (Exalted)
  const RARITY_MAP: Record<string, string> = { C: "C", R1: "R", R2: "F", E: "E" }
  const rarity = RARITY_MAP[raritySuffix] ?? raritySuffix

  return { collection, cardVariantType, faction, collectionNumber, rarity, uniqueId: null, isUnique: false }
}

// ── API Fetching ───────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<ApiResponse> {
  const res = await fetch(url, { headers: { Accept: "application/ld+json", "Accept-Language": LOCALE } })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchCardSets(): Promise<{ reference: string; name: string }[]> {
  const res = await fetch(`${BASE_URL}/card_sets?itemsPerPage=100&locale=${LOCALE}`, {
    headers: { Accept: "application/ld+json" },
  })
  const data = await res.json()
  return data["hydra:member"] ?? []
}

async function fetchCardsForSet(setRef: string): Promise<AlteredCard[]> {
  const cards: AlteredCard[] = []
  let url: string | undefined = `${BASE_URL}/cards?itemsPerPage=${PAGE_SIZE}&locale=${LOCALE}&cardSet[]=${setRef}`

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
  // Only fetch main collections — skip alternate/promo sets entirely at fetch time
  const allSets = await fetchCardSets()
  const mainSets = allSets.filter((s) => MAIN_COLLECTIONS.has(s.reference))
  console.log(`Fetching ${mainSets.length} main collections: ${mainSets.map((s) => s.reference).join(", ")}\n`)

  const all: AlteredCard[] = []
  const seen = new Set<string>()

  for (const set of mainSets) {
    process.stdout.write(`  ${set.reference} (${set.name})...`)
    const cards = await fetchCardsForSet(set.reference)
    let added = 0
    for (const c of cards) {
      if (!seen.has(c.reference)) {
        seen.add(c.reference)
        all.push(c)
        added++
      }
    }
    console.log(` ${added} cards`)
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`\nTotal: ${all.length} unique cards from main collections.`)

  // Save raw API response to cache for future re-imports (no need to call API again)
  mkdirSync(CACHE_DIR, { recursive: true })
  const cachePath = join(CACHE_DIR, `api-cards-${Date.now()}.json`)
  writeFileSync(cachePath, JSON.stringify(all, null, 2))
  console.log(`Raw API response saved to: ${cachePath}`)

  return all
}

function loadFromCache(filePath: string): AlteredCard[] {
  console.log(`Loading cards from cache: ${filePath}`)
  const raw = readFileSync(filePath, "utf-8")
  const cards = JSON.parse(raw) as AlteredCard[]
  console.log(`Loaded ${cards.length} cards from cache.\n`)
  return cards
}

// ── Classification ─────────────────────────────────────────────────────────

type ClassifiedCards = {
  toImport: { parsed: ParsedRef; card: AlteredCard }[]
  skipped: SkippedCard[]
}

function classifyCards(cards: AlteredCard[]): ClassifiedCards {
  const toImport: { parsed: ParsedRef; card: AlteredCard }[] = []
  const skipped: SkippedCard[] = []

  for (const card of cards) {
    const parsed = parseReference(card.reference)

    if (!parsed) {
      skipped.push({ reference: card.reference, name: card.name, reason: "unparseable_reference", raw: card })
      continue
    }

    if (parsed.cardVariantType !== MAIN_CARD_TYPE) {
      // A = alternate art (same stats as B, different image URI)
      // P = promo (same stats as B, different image URI)
      // Both are skipped for now and saved to file for future linking to their base card.
      const label = parsed.cardVariantType === "A" ? "alternate_art" : parsed.cardVariantType === "P" ? "promo" : `unknown_variant:${parsed.cardVariantType}`
      skipped.push({ reference: card.reference, name: card.name, reason: label, raw: card })
      continue
    }

    if (!card.cardType?.reference) {
      skipped.push({ reference: card.reference, name: card.name, reason: "missing_cardType", raw: card })
      continue
    }

    toImport.push({ parsed, card })
  }

  return { toImport, skipped }
}

// ── Map card type ──────────────────────────────────────────────────────────

function mapCardType(ref: string): string {
  const map: Record<string, string> = {
    CHARACTER: "Character",
    PERMANENT: "Permanent",
    SPELL: "Spell",
    TOKEN: "Token",
    HERO: "Hero",
    FOILER: "Foiler",
    EXPEDITION_PERK: "Expedition Perk",
  }
  return map[ref.toUpperCase()] ?? ref
}

function getImageUrl(card: AlteredCard): string | null {
  if (card.allImagePath) {
    const img = (card.allImagePath as Record<string, string>)[LOCALE]
      ?? (card.allImagePath as Record<string, string>)["en-us"]
    if (img) return img
  }
  return (card.imagePath as string) ?? null
}

// ── Upsert ─────────────────────────────────────────────────────────────────

async function upsertCard(parsed: ParsedRef, card: AlteredCard): Promise<void> {
  const el = card.elements ?? {}
  const imageUrl = getImageUrl(card)

  const common = {
    name: card.name,
    faction: parsed.faction,
    type: mapCardType(card.cardType!.reference),
    mainCost: el.MAIN_COST != null ? parseInt(el.MAIN_COST) : null,
    recallCost: el.RECALL_COST != null ? parseInt(el.RECALL_COST) : null,
    forestPower: el.FOREST_POWER != null ? parseInt(el.FOREST_POWER) : null,
    mountainPower: el.MOUNTAIN_POWER != null ? parseInt(el.MOUNTAIN_POWER) : null,
    oceanPower: el.OCEAN_POWER != null ? parseInt(el.OCEAN_POWER) : null,
    variants: imageUrl
      ? [{ variantId: card.reference, language: LOCALE.split("-")[0], imageUrl, isCollectorArt: false }]
      : [],
  }

  if (parsed.isUnique) {
    await prisma.uniqueCard.upsert({
      where: {
        collection_collectionNumber_uniqueId: {
          collection: parsed.collection,
          collectionNumber: parsed.collectionNumber,
          uniqueId: parsed.uniqueId!,
        },
      },
      update: { rarity: "U", ...common },
      create: {
        collection: parsed.collection,
        collectionNumber: parsed.collectionNumber,
        uniqueId: parsed.uniqueId!,
        rarity: "U",
        ...common,
      },
    })
  } else {
    await prisma.card.upsert({
      where: {
        collection_collectionNumber_rarity: {
          collection: parsed.collection,
          collectionNumber: parsed.collectionNumber,
          rarity: parsed.rarity,
        },
      },
      update: common,
      create: {
        collection: parsed.collection,
        collectionNumber: parsed.collectionNumber,
        rarity: parsed.rarity,
        ...common,
      },
    })
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Altered TCG Card Importer`)
  console.log(`Collections: ${[...MAIN_COLLECTIONS].join(", ")}`)
  console.log(`Card type filter: ${MAIN_CARD_TYPE} (base only)`)
  console.log(`Source: ${fromCacheFile ? `cache (${fromCacheFile})` : "API (response will be cached)"}`)
  console.log(dryRun ? "Mode: DRY RUN\n" : "Mode: LIVE\n")
  console.log("─".repeat(50))

  const cards = fromCacheFile ? loadFromCache(fromCacheFile) : await fetchAllCards()
  const { toImport, skipped } = classifyCards(cards)

  console.log(`\nTo import: ${toImport.length} | Skipped: ${skipped.length}`)

  // Save skipped cards to file
  if (skipped.length > 0) {
    const outPath = join(import.meta.dir, `skipped-cards-${Date.now()}.json`)
    const byReason = skipped.reduce<Record<string, SkippedCard[]>>((acc, s) => {
      acc[s.reason] = acc[s.reason] ?? []
      acc[s.reason].push(s)
      return acc
    }, {})
    writeFileSync(outPath, JSON.stringify({ total: skipped.length, byReason }, null, 2))
    console.log(`Skipped cards saved to: ${outPath}`)
  }

  if (dryRun) {
    console.log("\nDry run — no DB writes.")
    return
  }

  let imported = 0
  let errors = 0

  for (const { parsed, card } of toImport) {
    try {
      await upsertCard(parsed, card)
      imported++
      if (imported % 50 === 0) {
        process.stdout.write(`\r  Progress: ${imported}/${toImport.length}`)
      }
    } catch (err) {
      errors++
      console.error(`\n  Error: "${card.name}" (${card.reference}): ${err}`)
    }
  }

  console.log(`\n\nDone!`)
  console.log(`  Imported: ${imported}`)
  console.log(`  Errors:   ${errors}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
