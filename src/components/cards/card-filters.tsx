"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

const FACTIONS = [
  { value: "AX", label: "Axiom" },
  { value: "BR", label: "Bravos" },
  { value: "LY", label: "Lyra" },
  { value: "MU", label: "Muna" },
  { value: "OR", label: "Ordis" },
  { value: "YZ", label: "Yzmir" },
]

const TYPES = ["Character", "Spell", "Permanent", "Token", "Hero"]
const RARITIES = [
  { value: "C", label: "Common" },
  { value: "R", label: "Rare" },
  { value: "F", label: "Faction-shifted" },
  { value: "E", label: "Exalted" },
  { value: "U", label: "Unique" },
]

export function CardFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams]
  )

  const clearAll = useCallback(() => {
    startTransition(() => router.push(pathname))
  }, [router, pathname])

  const hasFilters =
    searchParams.has("search") ||
    searchParams.has("faction") ||
    searchParams.has("type") ||
    searchParams.has("rarity") ||
    searchParams.has("collection")

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        placeholder="Buscar por nome ou texto..."
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => {
          const val = e.target.value
          const timeout = setTimeout(() => updateParam("search", val), 400)
          return () => clearTimeout(timeout)
        }}
        className="sm:w-64"
      />

      <Select
        value={searchParams.get("faction") ?? ""}
        onValueChange={(v) => updateParam("faction", v === "all" ? "" : v)}
      >
        <SelectTrigger className="sm:w-40">
          <SelectValue placeholder="Fação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as fações</SelectItem>
          {FACTIONS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("type") ?? ""}
        onValueChange={(v) => updateParam("type", v === "all" ? "" : v)}
      >
        <SelectTrigger className="sm:w-40">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("rarity") ?? ""}
        onValueChange={(v) => updateParam("rarity", v === "all" ? "" : v)}
      >
        <SelectTrigger className="sm:w-36">
          <SelectValue placeholder="Raridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {RARITIES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Limpar filtros
        </Button>
      )}
    </div>
  )
}
