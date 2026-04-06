/**
 * Import Altered TCG cards from the official API
 * Usage: bun run scripts/import-altered-api.ts [--locale en-us|fr-fr|es-es|de-de|pt-br] [--dry-run]
 *
 * Fetches all cards from api.altered.gg and upserts them into the local database.
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

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

type AlteredVariant = {
  reference: string
  imageUrl: string | null
  rarity?: { reference: string }
  mainFoil?: boolean
  isCollector?: boolean
}

type AlteredCard = {
  reference: string
  name: string
  type: { reference: string }
  mainFaction: { reference: string }
  rarity: { reference: string }
  elements?: {
    MAIN_COST?: string
    RECALL_COST?: string
    FOREST_POWER?: string
    MOUNTAIN_POWER?: string
    OCEAN_POWER?: string
    MAIN_EFFECT?: string
    ECHO_EFFECT?: string
  }
  imagePath?: string
  variants?: AlteredVariant[]
  artists?: { name: string }[]
  // For Unique cards
  id?: number
}

type ApiResponse = {
  "hydra:member": AlteredCard[]
  "hydra:totalItems": number
  "hydra:view"?: {
    "@id": string
    "hydra:next"?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractFaction(ref: string): string {
  // e.g. "F_AX" → "AX", "F_BR" → "BR"
  return ref.replace("F_", "").toUpperCase()
}

function extractRarity(ref: string): string {
  // e.g. "R1" → "C", "R2" → "R", "R3" → "R", "R4" → "F", "R5" → "E", "R6" → "U"
  const map: Record<string, string> = {
    R1: "C", // Common
    R2: "R", // Rare
    R3: "R", // Rare variant
    R4: "F", // Faction-shifted
    R5: "E", // Exalted
    R6: "U", // Unique
  }
  return map[ref] ?? ref
}

function extractType(ref: string): string {
  // e.g. "TYPE_HERO" → "Hero", "TYPE_PERMANENT" → "Permanent"
  const map: Record<string, string> = {
    TYPE_HERO: "Hero",
    TYPE_PERMANENT: "Permanent",
    TYPE_SPELL: "Spell",
    TYPE_TOKEN: "Token",
    TYPE_FOILER: "Foiler",
  }
  return map[ref] ?? ref.replace("TYPE_", "").charAt(0).toUpperCase() + ref.replace("TYPE_", "").slice(1).toLowerCase()
}

function parseRef(reference: string) {
  // Reference format: "ALT_CORE_B_AX_01_C" or similar
  // We'll use the reference as the setCode and derive collectionNumber from a hash
  const parts = reference.split("_")
  const setCode = parts.slice(0, 2).join("_") // e.g. "ALT_CORE"
  const collectionNumber = Math.abs(hashCode(reference)) % 100000
  return { setCode, collectionNumber }
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash
}

function buildVariants(card: AlteredCard): object[] {
  const variants: object[] = []
  const artist = card.artists?.[0]?.name ?? "Unknown"

  if (card.variants && card.variants.length > 0) {
    for (const v of card.variants) {
      if (v.imageUrl) {
        variants.push({
          variantId: v.reference,
          language: locale.split("-")[0],
          imageUrl: v.imageUrl,
          artist,
          isCollectorArt: v.isCollector ?? v.mainFoil ?? false,
        })
      }
    }
  } else if (card.imagePath) {
    variants.push({
      variantId: card.reference,
      language: locale.split("-")[0],
      imageUrl: card.imagePath,
      artist,
      isCollectorArt: false,
    })
  }

  return variants
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<ApiResponse> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/ld+json",
      "Accept-Language": locale,
    },
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function fetchAllCards(): Promise<AlteredCard[]> {
  const all: AlteredCard[] = []
  let url: string | undefined =
    `${BASE_URL}/cards?itemsPerPage=${PAGE_SIZE}&locale=${locale}`

  while (url) {
    console.log(`  Fetching: ${url}`)
    const data = await fetchPage(url)
    all.push(...data["hydra:member"])
    const nextPath = data["hydra:view"]?.["hydra:next"]
    url = nextPath ? `${BASE_URL}${nextPath}` : undefined
    // Small delay to be polite to the API
    if (url) await new Promise((r) => setTimeout(r, 300))
  }

  return all
}

// ── Import ─────────────────────────────────────────────────────────────────

async function importCard(card: AlteredCard): Promise<"imported" | "skipped"> {
  // Skip cards missing essential fields
  if (!card.rarity?.reference || !card.mainFaction?.reference || !card.type?.reference) {
    return "skipped"
  }

  const rarity = extractRarity(card.rarity.reference)
  const faction = extractFaction(card.mainFaction.reference)
  const type = extractType(card.type.reference)
  const variants = buildVariants(card)
  const { setCode, collectionNumber } = parseRef(card.reference)

  const el = card.elements ?? {}
  const mainCost = el.MAIN_COST ? parseInt(el.MAIN_COST) : null
  const recallCost = el.RECALL_COST ? parseInt(el.RECALL_COST) : null
  const forestPower = el.FOREST_POWER ? parseInt(el.FOREST_POWER) : null
  const mountainPower = el.MOUNTAIN_POWER ? parseInt(el.MOUNTAIN_POWER) : null
  const oceanPower = el.OCEAN_POWER ? parseInt(el.OCEAN_POWER) : null
  const mainEffect = el.MAIN_EFFECT ?? null
  const echoEffect = el.ECHO_EFFECT ?? null

  if (dryRun) return "imported"

  if (rarity === "U") {
    const uniqueId = card.id ?? Math.abs(hashCode(card.reference)) % 1000000
    await prisma.uniqueCard.upsert({
      where: {
        collection_collectionNumber_uniqueId: {
          collection: setCode,
          collectionNumber,
          uniqueId,
        },
      },
      update: {
        name: card.name,
        faction,
        type,
        mainCost,
        recallCost,
        forestPower,
        mountainPower,
        oceanPower,
        abilityText: mainEffect,
        ...(variants.length > 0 && { variants }),
      },
      create: {
        collection: setCode,
        collectionNumber,
        uniqueId,
        rarity: "U",
        name: card.name,
        faction,
        type,
        mainCost,
        recallCost,
        forestPower,
        mountainPower,
        oceanPower,
        abilityText: mainEffect,
        variants: variants.length > 0 ? variants : undefined,
      },
    })
  } else {
    await prisma.card.upsert({
      where: {
        collection_collectionNumber_rarity: {
          collection: setCode,
          collectionNumber,
          rarity,
        },
      },
      update: {
        name: card.name,
        faction,
        type,
        mainCost,
        recallCost,
        forestPower,
        mountainPower,
        oceanPower,
        mainEffect,
        echoEffect,
        ...(variants.length > 0 && { variants }),
      },
      create: {
        collection: setCode,
        collectionNumber,
        rarity,
        name: card.name,
        faction,
        type,
        mainCost,
        recallCost,
        forestPower,
        mountainPower,
        oceanPower,
        mainEffect,
        echoEffect,
        variants: variants.length > 0 ? variants : undefined,
      },
    })
  }

  return "imported"
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Altered TCG Card Importer`)
  console.log(`Locale: ${locale}${dryRun ? " | DRY RUN (no DB writes)" : ""}`)
  console.log("─".repeat(50))

  console.log("Fetching cards from API...")
  const cards = await fetchAllCards()
  console.log(`Found ${cards.length} cards total.\n`)

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const card of cards) {
    try {
      const result = await importCard(card)
      if (result === "skipped") {
        skipped++
      } else {
        imported++
      }
      if ((imported + skipped) % 100 === 0) {
        process.stdout.write(`\r  Progress: ${imported + skipped}/${cards.length} (${imported} imported, ${skipped} skipped)`)
      }
    } catch (err) {
      errors++
      console.error(`\n  Error importing "${card.name}" (${card.reference}): ${err}`)
    }
  }

  console.log(`\n\nDone!`)
  console.log(`  Imported: ${imported}`)
  console.log(`  Skipped:  ${skipped} (missing required fields)`)
  console.log(`  Errors:   ${errors}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
