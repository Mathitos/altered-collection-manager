import { NextRequest, NextResponse } from "next/server"
import Papa from "papaparse"
import { prisma } from "@/lib/prisma"

type CardRow = {
  collection: string
  collection_number: string
  rarity: string
  name: string
  faction: string
  type: string
  main_cost?: string
  recall_cost?: string
  forest_power?: string
  mountain_power?: string
  ocean_power?: string
  ability_text?: string
  support_text?: string
  flavor_text?: string
  translations?: string // JSON string
  variants?: string // JSON string
  unique_id?: string // Only for Unique cards
}

export async function POST(req: NextRequest) {
  const adminSecret = req.headers.get("x-admin-secret")
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }

  const text = await file.text()
  const { data, errors } = Papa.parse<CardRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV parse error", details: errors }, { status: 400 })
  }

  let imported = 0
  let skipped = 0
  const importErrors: string[] = []

  for (const row of data) {
    try {
      const isUnique = row.rarity === "U"

      const translations = row.translations ? JSON.parse(row.translations) : null
      const variants = row.variants ? JSON.parse(row.variants) : null

      if (isUnique) {
        if (!row.unique_id) {
          importErrors.push(`Row missing unique_id for Unique card: ${row.name}`)
          skipped++
          continue
        }

        await prisma.uniqueCard.upsert({
          where: {
            collection_collectionNumber_uniqueId: {
              collection: row.collection,
              collectionNumber: parseInt(row.collection_number),
              uniqueId: parseInt(row.unique_id),
            },
          },
          update: {
            name: row.name,
            faction: row.faction,
            type: row.type,
            mainCost: row.main_cost ? parseInt(row.main_cost) : null,
            recallCost: row.recall_cost ? parseInt(row.recall_cost) : null,
            forestPower: row.forest_power ? parseInt(row.forest_power) : null,
            mountainPower: row.mountain_power ? parseInt(row.mountain_power) : null,
            oceanPower: row.ocean_power ? parseInt(row.ocean_power) : null,
            abilityText: row.ability_text || null,
            supportText: row.support_text || null,
            flavorText: row.flavor_text || null,
            translations,
            variants,
          },
          create: {
            collection: row.collection,
            collectionNumber: parseInt(row.collection_number),
            uniqueId: parseInt(row.unique_id),
            rarity: "U",
            name: row.name,
            faction: row.faction,
            type: row.type,
            mainCost: row.main_cost ? parseInt(row.main_cost) : null,
            recallCost: row.recall_cost ? parseInt(row.recall_cost) : null,
            forestPower: row.forest_power ? parseInt(row.forest_power) : null,
            mountainPower: row.mountain_power ? parseInt(row.mountain_power) : null,
            oceanPower: row.ocean_power ? parseInt(row.ocean_power) : null,
            abilityText: row.ability_text || null,
            supportText: row.support_text || null,
            flavorText: row.flavor_text || null,
            translations,
            variants,
          },
        })
      } else {
        await prisma.card.upsert({
          where: {
            collection_collectionNumber_faction_rarity: {
              collection: row.collection,
              collectionNumber: parseInt(row.collection_number),
              faction: row.faction,
              rarity: row.rarity,
            },
          },
          update: {
            name: row.name,
            faction: row.faction,
            type: row.type,
            mainCost: row.main_cost ? parseInt(row.main_cost) : null,
            recallCost: row.recall_cost ? parseInt(row.recall_cost) : null,
            forestPower: row.forest_power ? parseInt(row.forest_power) : null,
            mountainPower: row.mountain_power ? parseInt(row.mountain_power) : null,
            oceanPower: row.ocean_power ? parseInt(row.ocean_power) : null,
            abilityText: row.ability_text || null,
            supportText: row.support_text || null,
            flavorText: row.flavor_text || null,
            translations,
            variants,
          },
          create: {
            collection: row.collection,
            collectionNumber: parseInt(row.collection_number),
            rarity: row.rarity,
            name: row.name,
            faction: row.faction,
            type: row.type,
            mainCost: row.main_cost ? parseInt(row.main_cost) : null,
            recallCost: row.recall_cost ? parseInt(row.recall_cost) : null,
            forestPower: row.forest_power ? parseInt(row.forest_power) : null,
            mountainPower: row.mountain_power ? parseInt(row.mountain_power) : null,
            oceanPower: row.ocean_power ? parseInt(row.ocean_power) : null,
            abilityText: row.ability_text || null,
            supportText: row.support_text || null,
            flavorText: row.flavor_text || null,
            translations,
            variants,
          },
        })
      }

      imported++
    } catch (err) {
      importErrors.push(`Error importing ${row.name}: ${err}`)
      skipped++
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: importErrors,
  })
}
