import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CardDetail } from "@/components/cards/card-detail"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = await prisma.card.findUnique({ where: { id } })

  if (!card) notFound()

  return (
    <div>
      <div className="container mx-auto px-4 pt-6">
        <Link href="/cards">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeftIcon className="size-4" />
            Voltar ao catálogo
          </Button>
        </Link>
      </div>
      <CardDetail card={card} />
    </div>
  )
}
