/**
 * Import promo/alternate art variants for existing cards
 *
 * For each Common (C) card in the DB, fetches `/cards/{reference}/variants`.
 * One API call per (collection, collectionNumber, faction) group.
 *
 * Rules:
 *   - B-type variants → skip (already separate DB cards)
 *   - P/A-type variants → link to DB card matching (collection, collectionNumber, faction, rarity)
 *
 * Example:
 *   Call:    ALT_BISE_B_LY_49_C/variants
 *   Returns: ALT_BISE_B_LY_49_R2  (type=B → skip)
 *            ALT_TCS3_P_LY_49_R1  (type=P, faction=LY, rarity=R1 → variant of BISE/49/LY/R)
 *
 * Usage:
 *   bun run import:variants            # fetch from API, update DB
 *   bun run import:variants --dry-run  # fetch from API, no DB writes
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { writeFileSync } from "fs"
import { join } from "path"

const BASE_URL = "https://api.altered.gg"
const LOCALE = "en-us"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

const DB_TO_API_RARITY: Record<string, string> = { C: "C", R: "R1", F: "R2", E: "E", U: "U" }
const API_TO_DB_RARITY: Record<string, string> = { C: "C", R1: "R", R2: "F", E: "E", U: "U" }

// Sets that use type B in their references but are alternate art of the main set,
// not separate cards in the DB. Map variant set → base set for DB lookup.
const ALTERNATE_SET_TO_BASE: Record<string, string> = { COREKS: "CORE" }

// ── Types ──────────────────────────────────────────────────────────────────

type AlteredVariant = {
  reference: string
  allImagePath?: Record<string, string>
  imagePath?: string
  [key: string]: unknown
}

type ParsedRef = {
  collection: string
  cardVariantType: string
  faction: string
  collectionNumber: number
  rarity: string
}

type ReportEntry = {
  baseRef: string
  variantRef: string
  savedToCard: string
  imageUrl: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseReference(ref: string): ParsedRef | null {
  const parts = ref.split("_")
  if (parts.length < 6 || parts[0] !== "ALT") return null

  const cardVariantType = parts[2]
  const faction = parts[3]
  const collectionNumber = parseInt(parts[4])
  if (isNaN(collectionNumber)) return null

  const raritySuffix = parts[5]
  if (raritySuffix === "U") return null

  const rarity = API_TO_DB_RARITY[raritySuffix] ?? raritySuffix
  return { collection: parts[1], cardVariantType, faction, collectionNumber, rarity }
}

function getImageUrl(variant: AlteredVariant): string | null {
  if (variant.allImagePath) {
    const img = variant.allImagePath[LOCALE] ?? variant.allImagePath["en-us"]
    if (img) return img
  }
  return (variant.imagePath as string) ?? null
}

async function fetchVariants(reference: string): Promise<AlteredVariant[]> {
  const url = `${BASE_URL}/cards/${reference}/variants?locale=${LOCALE}`
  const res = await fetch(url, {
    headers: { Accept: "application/ld+json", "Accept-Language": LOCALE },
  })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`API ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  if (Array.isArray(data)) return data
  return data["hydra:member"] ?? []
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("Altered TCG Variant Importer")
  console.log(dryRun ? "Mode: DRY RUN\n" : "Mode: LIVE\n")
  console.log("─".repeat(50))

  // Load all cards indexed by (collection, collectionNumber, faction, rarity)
  const dbCards = await prisma.card.findMany({
    select: { id: true, collection: true, collectionNumber: true, faction: true, rarity: true, variants: true },
    orderBy: [{ collection: "asc" }, { collectionNumber: "asc" }, { faction: "asc" }],
  })

  // Index for fast lookup: "COLLECTION_NUMBER_FACTION_RARITY" → card
  type DbCard = (typeof dbCards)[number]
  const cardIndex = new Map<string, DbCard>()
  for (const card of dbCards) {
    cardIndex.set(`${card.collection}_${card.collectionNumber}_${card.faction}_${card.rarity}`, card)
  }

  // Use only C-rarity cards as API call targets (one per collection/number/faction group)
  const cCards = dbCards.filter((c) => c.rarity === "C")

  console.log(`Loaded ${dbCards.length} cards total, ${cCards.length} C-rarity cards to query\n`)

  let processed = 0
  let variantsAdded = 0
  let errors = 0
  const report: ReportEntry[] = []

  for (const cCard of cCards) {
    const num = String(cCard.collectionNumber).padStart(2, "0")
    const baseRef = `ALT_${cCard.collection}_B_${cCard.faction}_${num}_C`

    try {
      const variants = await fetchVariants(baseRef)

      for (const variant of variants) {
        const parsed = parseReference(variant.reference)
        if (!parsed) continue

        // Variant type rules:
        //   P (promo)  → always a variant of the B card with the same collection/number/faction/rarity
        //   B (base)   → separate DB card, skip — EXCEPT sets in ALTERNATE_SET_TO_BASE (e.g. COREKS → CORE)
        //   A (alt art)→ treated same as P
        if (parsed.cardVariantType === "B" && !(parsed.collection in ALTERNATE_SET_TO_BASE)) continue

        const imageUrl = getImageUrl(variant)
        if (!imageUrl) continue

        // Resolve base collection for the DB lookup:
        //   - COREKS variants → look up in CORE
        //   - everything else → use the collection of the card we queried (cCard.collection)
        const baseCollection = ALTERNATE_SET_TO_BASE[parsed.collection] ?? cCard.collection

        // Match to DB card by (base collection, collectionNumber, faction, rarity) — rarity is preserved
        // e.g. ALT_CORE_P_BR_01_R1 links to CORE/1/BR/R, not to CORE/1/BR/C
        const targetKey = `${baseCollection}_${parsed.collectionNumber}_${parsed.faction}_${parsed.rarity}`
        const targetCard = cardIndex.get(targetKey)
        if (!targetCard) continue

        // Skip if already stored
        const existingVariants = (targetCard.variants as Array<{ variantId: string }>) ?? []
        if (existingVariants.some((v) => v.variantId === variant.reference)) continue

        const newVariantEntry = {
          variantId: variant.reference,
          language: LOCALE.split("-")[0],
          imageUrl,
          isCollectorArt: true,
        }

        const updatedVariants = [...existingVariants, newVariantEntry]

        if (!dryRun) {
          await prisma.card.update({
            where: { id: targetCard.id },
            data: { variants: updatedVariants },
          })
          // Update index so duplicate check works if same card appears again
          ;(targetCard as { variants: unknown }).variants = updatedVariants
        }

        variantsAdded++
        report.push({
          baseRef,
          variantRef: variant.reference,
          savedToCard: `${targetCard.collection}_${targetCard.collectionNumber}_${targetCard.faction}_${targetCard.rarity}`,
          imageUrl,
        })
      }

      processed++
      if (processed % 50 === 0) {
        process.stdout.write(`\r  Progress: ${processed}/${cCards.length}, variants found: ${variantsAdded}`)
      }

      await new Promise((r) => setTimeout(r, 150))
    } catch (err) {
      errors++
      console.error(`\n  Error for ${baseRef}: ${err}`)
    }
  }

  const reportPath = join(import.meta.dir, "variant-report.json")
  writeFileSync(reportPath, JSON.stringify({ total: report.length, variants: report }, null, 2))

  console.log(`\n\nDone!`)
  console.log(`  Cards queried:  ${processed}/${cCards.length}`)
  console.log(`  Variants added: ${variantsAdded}`)
  console.log(`  Errors:         ${errors}`)
  console.log(`  Report saved:   ${reportPath}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
