/**
 * Clear all card data from the database.
 * Usage: bun run db:clear
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  console.log("Clearing card data from database...")

  const [deckCards, uniqueCards, cards] = await Promise.all([
    prisma.deckCard.deleteMany(),
    prisma.uniqueCard.deleteMany(),
    prisma.card.deleteMany(),
  ])

  console.log(`Deleted:`)
  console.log(`  DeckCards:   ${deckCards.count}`)
  console.log(`  UniqueCards: ${uniqueCards.count}`)
  console.log(`  Cards:       ${cards.count}`)
  console.log("Done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
