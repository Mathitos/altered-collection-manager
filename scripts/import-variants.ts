/**
 * Import promo/alternate art variants for existing cards
 *
 * For each unique (collection, collectionNumber) in the DB, fetches
 * `/cards/{reference}/variants` using the Common (C) rarity reference.
 *
 * Rules:
 *   - B-type variants → skip (these are already separate DB cards)
 *   - P/A-type variants → link to the DB card matching (collection, collectionNumber, rarity)
 *
 * Example:
 *   Call:  ALT_BISE_B_LY_49_C/variants
 *   Returns: ALT_BISE_B_LY_49_R2 (type=B → skip)
 *            ALT_TCS3_P_LY_49_R1 (type=P, rarity=R1 → variant of BISE_49_R in DB)
 *
 * Usage:
 *   bun run import:variants            # fetch from API, update DB
 *   bun run import:variants --dry-run  # fetch from API, no DB writes
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"

const BASE_URL = "https://api.altered.gg"
const LOCALE = "en-us"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

const SCRIPTS_DIR = import.meta.dir

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// DB rarity → API rarity suffix (for building the reference string)
const DB_TO_API_RARITY: Record<string, string> = { C: "C", R: "R1", F: "R2", E: "E", U: "U" }

// API rarity suffix → DB rarity
const API_TO_DB_RARITY: Record<string, string> = { C: "C", R1: "R", R2: "F", E: "E", U: "U" }

// ── Types ──────────────────────────────────────────────────────────────────

type AlteredVariant = {
  reference: string
  name?: string
  allImagePath?: Record<string, string>
  imagePath?: string
  [key: string]: unknown
}

type ParsedRef = {
  collection: string
  cardVariantType: string
  faction: string
  collectionNumber: number
  rarity: string // DB rarity
}

type ReportEntry = {
  baseRef: string
  variantRef: string
  savedToCard: string // collection_number_rarity
  imageUrl: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseReference(ref: string): ParsedRef | null {
  const parts = ref.split("_")
  if (parts.length < 6 || parts[0] !== "ALT") return null

  const collection = parts[1]
  const cardVariantType = parts[2]
  const faction = parts[3]
  const collectionNumber = parseInt(parts[4])
  if (isNaN(collectionNumber)) return null

  const raritySuffix = parts[5]
  if (raritySuffix === "U") return null // Unique variants handled separately

  const rarity = API_TO_DB_RARITY[raritySuffix] ?? raritySuffix
  return { collection, cardVariantType, faction, collectionNumber, rarity }
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

  // Load all cards from DB
  const dbCards = await prisma.card.findMany({
    select: { id: true, collection: true, collectionNumber: true, faction: true, rarity: true, variants: true },
    orderBy: [{ collection: "asc" }, { collectionNumber: "asc" }],
  })

  // Group by (collection, collectionNumber)
  type DbCard = (typeof dbCards)[number]
  const groups = new Map<string, DbCard[]>()
  for (const card of dbCards) {
    const key = `${card.collection}_${card.collectionNumber}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(card)
  }

  console.log(`Loaded ${dbCards.length} cards across ${groups.size} groups\n`)

  let processed = 0
  let variantsAdded = 0
  let errors = 0
  const report: ReportEntry[] = []

  for (const [, groupCards] of groups) {
    // Use C rarity as representative; fall back to first card in group
    const representative = groupCards.find((c) => c.rarity === "C") ?? groupCards[0]
    const apiRarity = DB_TO_API_RARITY[representative.rarity] ?? representative.rarity
    const baseRef = `ALT_${representative.collection}_B_${representative.faction}_${representative.collectionNumber}_${apiRarity}`

    try {
      const variants = await fetchVariants(baseRef)

      for (const variant of variants) {
        const parsed = parseReference(variant.reference)
        if (!parsed) continue

        // Skip B-type: these are separate cards in our DB
        if (parsed.cardVariantType === "B") continue

        const imageUrl = getImageUrl(variant)
        if (!imageUrl) continue

        // Find which DB card this variant belongs to by matching rarity
        const targetCard = groupCards.find((c) => c.rarity === parsed.rarity)
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
          // Update in-memory so duplicate check works within same group
          ;(targetCard as { variants: unknown }).variants = updatedVariants
        }

        variantsAdded++
        report.push({
          baseRef,
          variantRef: variant.reference,
          savedToCard: `${targetCard.collection}_${targetCard.collectionNumber}_${targetCard.rarity}`,
          imageUrl,
        })
      }

      processed++
      if (processed % 20 === 0) {
        process.stdout.write(`\r  Progress: ${processed}/${groups.size} groups, ${variantsAdded} variants found`)
      }

      await new Promise((r) => setTimeout(r, 150))
    } catch (err) {
      errors++
      console.error(`\n  Error for ${baseRef}: ${err}`)
    }
  }

  const reportPath = join(SCRIPTS_DIR, "variant-report.json")
  writeFileSync(reportPath, JSON.stringify({ total: report.length, variants: report }, null, 2))

  console.log(`\n\nDone!`)
  console.log(`  Groups processed: ${processed}/${groups.size}`)
  console.log(`  Variants added:   ${variantsAdded}`)
  console.log(`  Errors:           ${errors}`)
  console.log(`  Report saved to:  ${reportPath}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
