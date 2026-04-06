import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 gap-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-xl font-semibold">Página não encontrada</h2>
      <p className="text-muted-foreground">O endereço que você tentou acessar não existe.</p>
      <Link href="/">
        <Button>Voltar ao início</Button>
      </Link>
    </div>
  )
}
