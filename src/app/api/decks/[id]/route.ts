import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

type Params = Promise<{ id: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const session = await auth()

  const deck = await prisma.deck.findUnique({
    where: { id },
    include: {
      heroCard: true,
      cards: {
        include: {
          card: true,
          uniqueCard: true,
        },
      },
    },
  })

  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Private decks only visible to owner
  if (!deck.isPublic && deck.userId !== session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ deck })
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const deck = await prisma.deck.findUnique({ where: { id } })
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, description, heroCardId, isPublic, cards } = body

  // Update deck metadata
  const updated = await prisma.deck.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      description: description?.trim() ?? null,
      ...(heroCardId && { heroCardId }),
      ...(typeof isPublic === "boolean" && { isPublic }),
    },
  })

  // Replace all deck cards if provided
  if (Array.isArray(cards)) {
    await prisma.deckCard.deleteMany({ where: { deckId: id } })
    if (cards.length > 0) {
      await prisma.deckCard.createMany({
        data: cards.map((c: { cardId?: string; uniqueCardId?: string; variantId?: string; quantity: number }) => ({
          deckId: id,
          cardId: c.cardId ?? null,
          uniqueCardId: c.uniqueCardId ?? null,
          variantId: c.variantId ?? null,
          quantity: c.quantity ?? 1,
        })),
      })
    }
  }

  return NextResponse.json({ deck: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const deck = await prisma.deck.findUnique({ where: { id } })
  if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.deck.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
