import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { DeckBuilder } from "@/components/decks/deck-builder"

export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [deck, heroes] = await Promise.all([
    prisma.deck.findUnique({
      where: { id },
      include: {
        heroCard: true,
        cards: { include: { card: true, uniqueCard: true } },
      },
    }),
    prisma.card.findMany({
      where: { type: "Hero" },
      orderBy: [{ faction: "asc" }, { name: "asc" }],
    }),
  ])

  if (!deck) notFound()
  if (deck.userId !== session.user.id) redirect("/decks")

  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold">Editar Deck</h1>
      </div>
      <DeckBuilder heroes={heroes} initialDeck={deck} />
    </div>
  )
}
