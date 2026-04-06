/**
 * Run a SQL migration file against the database.
 * Usage: bun run migrate <path-to-sql-file>
 * Example: bun run migrate prisma/migrations/fix_cards_unique_add_faction.sql
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "fs"

const file = process.argv[2]
if (!file) {
  console.error("Usage: bun run migrate <path-to-sql-file>")
  process.exit(1)
}

const sql = readFileSync(file, "utf-8")

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  console.log(`Running migration: ${file}\n`)
  console.log(sql)
  console.log("─".repeat(50))
  await prisma.$executeRawUnsafe(sql)
  console.log("✓ Migration applied successfully.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
