import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Params = Promise<{ shareToken: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { shareToken } = await params

  const deck = await prisma.deck.findUnique({
    where: { shareToken },
    include: {
      heroCard: true,
      cards: {
        include: { card: true, uniqueCard: true },
      },
    },
  })

  if (!deck || !deck.isPublic) {
    return NextResponse.json({ error: "Deck não encontrado" }, { status: 404 })
  }

  return NextResponse.json({ deck })
}
