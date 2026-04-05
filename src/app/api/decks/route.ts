import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const decks = await prisma.deck.findMany({
    where: { userId: session.user.id },
    include: {
      heroCard: { select: { id: true, name: true, faction: true } },
      _count: { select: { cards: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ decks })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, description, heroCardId, isPublic } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }
  if (!heroCardId) {
    return NextResponse.json({ error: "Herói é obrigatório" }, { status: 400 })
  }

  const deck = await prisma.deck.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || null,
      heroCardId,
      isPublic: isPublic ?? false,
    },
  })

  return NextResponse.json({ deck }, { status: 201 })
}
