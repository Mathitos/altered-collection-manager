import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"

const PAGE_SIZE = 24

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const search = searchParams.get("search")?.trim() ?? ""
  const faction = searchParams.get("faction") ?? ""
  const type = searchParams.get("type") ?? ""
  const rarity = searchParams.get("rarity") ?? ""
  const collection = searchParams.get("collection") ?? ""

  const where: Prisma.CardWhereInput = {
    ...(faction && { faction }),
    ...(type && { type }),
    ...(rarity && { rarity }),
    ...(collection && { collection }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { abilityText: { contains: search, mode: "insensitive" } },
        { supportText: { contains: search, mode: "insensitive" } },
      ],
    }),
  }

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy: [{ collection: "asc" }, { collectionNumber: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.card.count({ where }),
  ])

  return NextResponse.json({
    cards,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  })
}
