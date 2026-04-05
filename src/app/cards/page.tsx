import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { CardThumbnail } from "@/components/cards/card-thumbnail"
import { CardFilters } from "@/components/cards/card-filters"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Prisma } from "@/generated/prisma/client"

const PAGE_SIZE = 24

type SearchParams = {
  page?: string
  search?: string
  faction?: string
  type?: string
  rarity?: string
  collection?: string
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? "1"))
  const search = params.search?.trim() ?? ""
  const faction = params.faction ?? ""
  const type = params.type ?? ""
  const rarity = params.rarity ?? ""
  const collection = params.collection ?? ""

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

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Catálogo de Cartas</h1>
        <p className="text-muted-foreground mt-1">{total} cartas encontradas</p>
      </div>

      <div className="mb-6">
        <Suspense>
          <CardFilters />
        </Suspense>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-lg">Nenhuma carta encontrada.</p>
          {(search || faction || type || rarity) && (
            <Link href="/cards">
              <Button variant="outline" className="mt-4">
                Limpar filtros
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {cards.map((card) => (
              <CardThumbnail key={card.id} card={card} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={`/cards?${buildParams(params, { page: String(page - 1) })}`}>
                  <Button variant="outline" size="sm">Anterior</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <Link href={`/cards?${buildParams(params, { page: String(page + 1) })}`}>
                  <Button variant="outline" size="sm">Próxima</Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function buildParams(current: SearchParams, override: Partial<SearchParams>) {
  const p = new URLSearchParams()
  const merged = { ...current, ...override }
  for (const [k, v] of Object.entries(merged)) {
    if (v && k !== "page" || k === "page") {
      if (v) p.set(k, v)
    }
  }
  return p.toString()
}
