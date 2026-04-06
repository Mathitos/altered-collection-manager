"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 gap-4">
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="text-muted-foreground max-w-sm">
        Ocorreu um erro inesperado. Tente novamente ou entre em contato se o problema persistir.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
