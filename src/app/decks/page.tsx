import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusIcon } from "lucide-react"
import { DeleteDeckButton } from "@/components/decks/delete-deck-button"

export default async function DecksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const decks = await prisma.deck.findMany({
    where: { userId: session.user.id },
    include: {
      heroCard: { select: { name: true, faction: true } },
      _count: { select: { cards: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus Decks</h1>
          <p className="text-muted-foreground mt-1">{decks.length} deck{decks.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/decks/new">
          <Button>
            <PlusIcon className="size-4" />
            Novo Deck
          </Button>
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-lg">Nenhum deck ainda.</p>
          <Link href="/decks/new">
            <Button className="mt-4">Criar primeiro deck</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div key={deck.id} className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{deck.name}</h2>
                  {deck.heroCard && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Herói: {deck.heroCard.name} · {deck.heroCard.faction}
                    </p>
                  )}
                </div>
                <Badge variant={deck.isPublic ? "default" : "secondary"} className="shrink-0">
                  {deck.isPublic ? "Público" : "Privado"}
                </Badge>
              </div>
              {deck.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{deck.description}</p>
              )}
              <p className="text-xs text-muted-foreground">{deck._count.cards} cartas</p>
              <div className="flex gap-2 mt-auto">
                <Link href={`/decks/${deck.id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Editar</Button>
                </Link>
                <DeleteDeckButton deckId={deck.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
