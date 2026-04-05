import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { DeckBuilder } from "@/components/decks/deck-builder"

export default async function NewDeckPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const heroes = await prisma.card.findMany({
    where: { type: "Hero" },
    orderBy: [{ faction: "asc" }, { name: "asc" }],
  })

  return (
    <div>
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold">Novo Deck</h1>
      </div>
      <DeckBuilder heroes={heroes} />
    </div>
  )
}
