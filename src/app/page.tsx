import Link from "next/link"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { LayersIcon, SearchIcon, ShieldIcon } from "lucide-react"

export default async function HomePage() {
  const session = await auth()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-24 sm:py-32">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl max-w-2xl">
          Gerencie sua coleção do{" "}
          <span className="text-primary">Altered TCG</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl">
          Catálogo completo de cartas, construção de decks com validação em tempo real e compartilhamento via link.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link href="/cards">
            <Button size="lg">Ver cartas</Button>
          </Link>
          {session?.user ? (
            <Link href="/decks">
              <Button size="lg" variant="outline">Meus decks</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg" variant="outline">Entrar com Google</Button>
            </Link>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-16 grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <SearchIcon className="size-6 text-primary" />
            <h2 className="font-semibold">Catálogo completo</h2>
            <p className="text-sm text-muted-foreground">
              Navegue, busque e filtre todas as cartas por fação, tipo, raridade e coleção.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <LayersIcon className="size-6 text-primary" />
            <h2 className="font-semibold">Construtor de decks</h2>
            <p className="text-sm text-muted-foreground">
              Monte decks com validação das regras do formato Standard em tempo real.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <ShieldIcon className="size-6 text-primary" />
            <h2 className="font-semibold">Compartilhe</h2>
            <p className="text-sm text-muted-foreground">
              Torne seu deck público e compartilhe via link sem necessidade de cadastro para visualizar.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
