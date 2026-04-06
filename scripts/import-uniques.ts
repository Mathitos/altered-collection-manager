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
const PAGE_SIZE = 1000

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

async function fetchPage(url: string, attempt = 0): Promise<ApiResponse> {
  const res = await fetch(url, {
    headers: { Accept: "application/ld+json", "Accept-Language": LOCALE },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "30")
    const wait = Math.max(retryAfter, 30) * 1000 * (attempt + 1) // exponential
    process.stdout.write(`\n  Rate limited — waiting ${wait / 1000}s (attempt ${attempt + 1})...\n`)
    await new Promise((r) => setTimeout(r, wait))
    if (attempt >= 4) throw new Error("Rate limit persists after 5 retries")
    return fetchPage(url, attempt + 1)
  }

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
    if (url) await new Promise((r) => setTimeout(r, 2000))
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
  let errors = 0

  for (const group of groups) {
    const num = String(group.collectionNumber).padStart(2, "0")
    const queryRef = `ALT_${group.collection}_B_${group.rFaction}_${num}_R1`

    for (const faction of group.factions) {
      try {
        const uniques = await fetchUniques(queryRef, faction)

        // Build batch payload for all valid uniques in this query
        type Row = {
          collection: string; collectionNumber: number; uniqueId: number
          name: string; faction: string; type: string; rarity: string
          mainCost: number | null; recallCost: number | null
          forestPower: number | null; mountainPower: number | null; oceanPower: number | null
          isSuspended: boolean; isErrated: boolean; isBanned: boolean
          variants: object
        }
        const rows: Row[] = []

        for (const card of uniques) {
          const parsed = parseUniqueReference(card.reference)
          if (!parsed) continue

          const imageUrl = getImageUrl(card)
          const el = card.elements ?? {}

          rows.push({
            collection: parsed.collection,
            collectionNumber: parsed.collectionNumber,
            uniqueId: parsed.uniqueId,
            rarity: "U",
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
          })
        }

        if (!dryRun && rows.length > 0) {
          // Single bulk upsert per batch — one roundtrip instead of N×2
          const result = await prisma.$executeRaw`
            INSERT INTO unique_cards (
              id, collection, "collectionNumber", "uniqueId", rarity, name, faction, type,
              "mainCost", "recallCost", "forestPower", "mountainPower", "oceanPower",
              "isSuspended", "isErrated", "isBanned", variants
            )
            SELECT
              gen_random_uuid(),
              r.collection, r."collectionNumber", r."uniqueId", r.rarity, r.name, r.faction, r.type,
              r."mainCost", r."recallCost", r."forestPower", r."mountainPower", r."oceanPower",
              r."isSuspended", r."isErrated", r."isBanned", r.variants
            FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(
              collection text, "collectionNumber" int, "uniqueId" int, rarity text,
              name text, faction text, type text,
              "mainCost" int, "recallCost" int, "forestPower" int, "mountainPower" int, "oceanPower" int,
              "isSuspended" boolean, "isErrated" boolean, "isBanned" boolean,
              variants jsonb
            )
            ON CONFLICT (collection, "collectionNumber", "uniqueId") DO UPDATE SET
              name         = EXCLUDED.name,
              faction      = EXCLUDED.faction,
              type         = EXCLUDED.type,
              "mainCost"   = EXCLUDED."mainCost",
              "recallCost" = EXCLUDED."recallCost",
              "forestPower"   = EXCLUDED."forestPower",
              "mountainPower" = EXCLUDED."mountainPower",
              "oceanPower"    = EXCLUDED."oceanPower",
              "isSuspended" = EXCLUDED."isSuspended",
              "isErrated"   = EXCLUDED."isErrated",
              "isBanned"    = EXCLUDED."isBanned",
              variants      = EXCLUDED.variants
          `
          imported += rows.length
        } else {
          imported += rows.length
        }

        queriesDone++
        process.stdout.write(`\r  Progress: ${queriesDone}/${totalQueries} | upserted: ${imported}`)

        await new Promise((r) => setTimeout(r, 30000))
      } catch (err) {
        errors++
        console.error(`\n  Error — query=${queryRef} faction=${faction}: ${err}`)
      }
    }
  }

  console.log(`\n\nDone!`)
  console.log(`  Queries made: ${queriesDone}/${totalQueries}`)
  console.log(dryRun ? `  Would upsert: ${imported}` : `  Upserted: ${imported}`)
  console.log(`  Errors:   ${errors}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
