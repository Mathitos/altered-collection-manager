import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

const perCollection = await prisma.$queryRaw<{ collection: string; families: bigint; rf_cards: bigint }[]>`
  SELECT collection,
         COUNT(DISTINCT "collectionNumber") AS families,
         COUNT(*) FILTER (WHERE rarity IN ('R','F')) AS rf_cards
  FROM cards
  GROUP BY collection
  ORDER BY collection
`

console.log("Por coleção:")
for (const r of perCollection) {
  console.log(`  ${r.collection}: ${r.families} famílias, ${r.rf_cards} cards R/F`)
}

const total = await prisma.$queryRaw<{ families: bigint }[]>`
  SELECT COUNT(DISTINCT (collection, "collectionNumber")) AS families
  FROM cards
  WHERE rarity IN ('R', 'F')
`
console.log(`\nTotal grupos (collection+collectionNumber com R ou F): ${total[0].families}`)

await prisma.$disconnect()
