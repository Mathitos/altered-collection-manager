/**
 * Import unique cards from the Altered TCG API.
 *
 * Strategy:
 *   The API returns at most 1000 results per query. To ensure full coverage,
 *   we query once per faction for each card family (collection + collectionNumber).
 *
 *   For each (collection, collectionNumber) group that has R or F cards in the DB:
 *     - Use the R card's reference as the search query (e.g. ALT_BISE_B_LY_49_R1)
 *     - Query once per distinct faction found in that group (R and F can have different factions)
 *     - Paginate through all results
 *     - Upsert each unique card — status fields (isSuspended, isErrated, isBanned) are always updated
 *
 * Usage:
 *   bun run import:uniques            # fetch from API, update DB
 *   bun run import:uniques --dry-run  # fetch from API, no DB writes
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const BASE_URL = "https://api.altered.gg"
const LOCALE = "en-us"
const PAGE_SIZE = 108

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// ── Types ──────────────────────────────────────────────────────────────────

type ApiUniqueCard = {
  reference: string
  name: string
  cardType?: { reference: string }
  mainFaction?: { reference: string }
  elements?: Record<string, string>
  allImagePath?: Record<string, string>
  imagePath?: string
  isSuspended?: boolean
  isErrated?: boolean
  isBanned?: boolean
  [key: string]: unknown
}

type ApiResponse = {
  "hydra:member": ApiUniqueCard[]
  "hydra:totalItems": number
  "hydra:view"?: { "hydra:next"?: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseUniqueReference(ref: string): {
  collection: string
  faction: string
  collectionNumber: number
  uniqueId: number
} | null {
  // Format: ALT_BISE_B_LY_49_U_5159
  const parts = ref.split("_")
  if (parts.length < 7 || parts[0] !== "ALT" || parts[5] !== "U") return null

  const collection = parts[1]
  const faction = parts[3]
  const collectionNumber = parseInt(parts[4])
  const uniqueId = parseInt(parts[6])

  if (isNaN(collectionNumber) || isNaN(uniqueId)) return null
  return { collection, faction, collectionNumber, uniqueId }
}

function getImageUrl(card: ApiUniqueCard): string | null {
  if (card.allImagePath) {
    const img = card.allImagePath[LOCALE] ?? card.allImagePath["en-us"]
    if (img) return img
  }
  return (card.imagePath as string) ?? null
}

function mapCardType(ref: string): string {
  const map: Record<string, string> = {
    CHARACTER: "Character",
    PERMANENT: "Permanent",
    SPELL: "Spell",
    TOKEN: "Token",
    HERO: "Hero",
  }
  return map[ref.toUpperCase()] ?? ref
}

async function fetchPage(url: string): Promise<ApiResponse> {
  const res = await fetch(url, {
    headers: { Accept: "application/ld+json", "Accept-Language": LOCALE },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchUniques(queryRef: string, faction: string): Promise<ApiUniqueCard[]> {
  const results: ApiUniqueCard[] = []
  let url: string | undefined =
    `${BASE_URL}/cards?factions[]=${faction}&itemsPerPage=${PAGE_SIZE}&query=${queryRef}&rarity[]=UNIQUE&locale=${LOCALE}`

  while (url) {
    const data = await fetchPage(url)
    results.push(...data["hydra:member"])
    const next = data["hydra:view"]?.["hydra:next"]
    url = next ? `${BASE_URL}${next}` : undefined
    if (url) await new Promise((r) => setTimeout(r, 200))
  }

  return results
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("Altered TCG Unique Card Importer")
  console.log(dryRun ? "Mode: DRY RUN\n" : "Mode: LIVE\n")
  console.log("─".repeat(50))

  // Load all R and F cards — these are the families that have unique variants
  const rfCards = await prisma.card.findMany({
    where: { rarity: { in: ["R", "F"] } },
    select: { collection: true, collectionNumber: true, faction: true, rarity: true },
    orderBy: [{ collection: "asc" }, { collectionNumber: "asc" }],
  })

  console.log(`Loaded ${rfCards.length} R/F cards from DB`)

  // Group by (collection, collectionNumber):
  //   rFaction = faction of the R card, used to build the R1 query reference
  //   factions = all distinct factions in this group (R + F may differ)
  type Group = {
    collection: string
    collectionNumber: number
    rFaction: string
    factions: Set<string>
  }

  const groupMap = new Map<string, Group>()

  for (const card of rfCards) {
    const key = `${card.collection}_${card.collectionNumber}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        collection: card.collection,
        collectionNumber: card.collectionNumber,
        rFaction: card.faction,
        factions: new Set(),
      })
    }
    const group = groupMap.get(key)!
    group.factions.add(card.faction)
    if (card.rarity === "R") group.rFaction = card.faction
  }

  const groups = [...groupMap.values()]

  // Total queries = one per (group × faction)
  const totalQueries = groups.reduce((sum, g) => sum + g.factions.size, 0)
  console.log(`Card families: ${groups.length} | API queries to make: ${totalQueries}\n`)

  let queriesDone = 0
  let imported = 0
  let updated = 0
  let errors = 0

  for (const group of groups) {
    const num = String(group.collectionNumber).padStart(2, "0")
    const queryRef = `ALT_${group.collection}_B_${group.rFaction}_${num}_R1`

    for (const faction of group.factions) {
      try {
        const uniques = await fetchUniques(queryRef, faction)

        for (const card of uniques) {
          const parsed = parseUniqueReference(card.reference)
          if (!parsed) continue

          const imageUrl = getImageUrl(card)
          const el = card.elements ?? {}

          const payload = {
            name: card.name,
            faction: parsed.faction,
            type: mapCardType(card.cardType?.reference ?? "CHARACTER"),
            mainCost: el.MAIN_COST != null ? parseInt(el.MAIN_COST) : null,
            recallCost: el.RECALL_COST != null ? parseInt(el.RECALL_COST) : null,
            forestPower: el.FOREST_POWER != null ? parseInt(el.FOREST_POWER) : null,
            mountainPower: el.MOUNTAIN_POWER != null ? parseInt(el.MOUNTAIN_POWER) : null,
            oceanPower: el.OCEAN_POWER != null ? parseInt(el.OCEAN_POWER) : null,
            isSuspended: card.isSuspended ?? false,
            isErrated: card.isErrated ?? false,
            isBanned: card.isBanned ?? false,
            variants: imageUrl
              ? [{ variantId: card.reference, language: LOCALE.split("-")[0], imageUrl, isCollectorArt: false }]
              : [],
          }

          if (!dryRun) {
            const key = {
              collection: parsed.collection,
              collectionNumber: parsed.collectionNumber,
              uniqueId: parsed.uniqueId,
            }
            const existing = await prisma.uniqueCard.findUnique({
              where: { collection_collectionNumber_uniqueId: key },
              select: { id: true },
            })

            await prisma.uniqueCard.upsert({
              where: { collection_collectionNumber_uniqueId: key },
              update: payload,
              create: { ...key, rarity: "U", ...payload },
            })

            if (existing) updated++ else imported++
          } else {
            imported++
          }
        }

        queriesDone++
        process.stdout.write(`\r  Progress: ${queriesDone}/${totalQueries} | imported: ${imported} | updated: ${updated}`)

        await new Promise((r) => setTimeout(r, 150))
      } catch (err) {
        errors++
        console.error(`\n  Error — query=${queryRef} faction=${faction}: ${err}`)
      }
    }
  }

  console.log(`\n\nDone!`)
  console.log(`  Queries made: ${queriesDone}/${totalQueries}`)
  console.log(dryRun ? `  Would import: ${imported}` : `  Imported: ${imported} | Updated: ${updated}`)
  console.log(`  Errors:   ${errors}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
