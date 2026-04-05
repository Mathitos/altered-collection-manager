"use client"

import { useState, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { validateDeck, type DeckCardEntry } from "@/lib/deck-validation"
import type { Card, UniqueCard, Deck, DeckCard } from "@/generated/prisma/client"
import { PlusIcon, MinusIcon, SaveIcon, AlertTriangleIcon, CheckCircleIcon, SearchIcon, LinkIcon, CheckIcon } from "lucide-react"

type Variant = { variantId: string; language: string; imageUrl: string; artist: string; isCollectorArt: boolean }

type DeckCardWithCard = DeckCard & { card: Card | null; uniqueCard: UniqueCard | null }

type Props = {
  heroes: Card[]
  initialDeck?: Deck & { heroCard: Card; cards: DeckCardWithCard[] }
}

export function DeckBuilder({ heroes, initialDeck }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [name, setName] = useState(initialDeck?.name ?? "")
  const [description, setDescription] = useState(initialDeck?.description ?? "")
  const [heroCardId, setHeroCardId] = useState(initialDeck?.heroCardId ?? "")
  const [isPublic, setIsPublic] = useState(initialDeck?.isPublic ?? false)
  const [deckCards, setDeckCards] = useState<DeckCardEntry[]>(
    initialDeck?.cards.map((dc) => ({
      cardId: dc.cardId,
      uniqueCardId: dc.uniqueCardId,
      quantity: dc.quantity,
      card: dc.card,
      uniqueCard: dc.uniqueCard,
    })) ?? []
  )

  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = initialDeck?.isPublic && initialDeck?.shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/deck/${initialDeck.shareToken}`
    : null

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const heroCard = heroes.find((h) => h.id === heroCardId) ?? null
  const validation = validateDeck(heroCard, deckCards)

  async function searchCards(query: string) {
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    const res = await fetch(`/api/cards?search=${encodeURIComponent(query)}&limit=20`)
    const data = await res.json()
    setSearchResults((data.cards ?? []).filter((c: Card) => c.type !== "Hero"))
    setSearching(false)
  }

  const addCard = useCallback((card: Card) => {
    setDeckCards((prev) => {
      const existing = prev.find((dc) => dc.cardId === card.id)
      if (existing) {
        return prev.map((dc) =>
          dc.cardId === card.id ? { ...dc, quantity: dc.quantity + 1 } : dc
        )
      }
      return [...prev, { cardId: card.id, quantity: 1, card }]
    })
  }, [])

  const removeCard = useCallback((cardId: string) => {
    setDeckCards((prev) => {
      const existing = prev.find((dc) => dc.cardId === cardId)
      if (!existing) return prev
      if (existing.quantity <= 1) return prev.filter((dc) => dc.cardId !== cardId)
      return prev.map((dc) => dc.cardId === cardId ? { ...dc, quantity: dc.quantity - 1 } : dc)
    })
  }, [])

  async function save() {
    if (!name.trim() || !heroCardId) return
    setSaving(true)

    const payload = {
      name,
      description,
      heroCardId,
      isPublic,
      cards: deckCards.map((dc) => ({
        cardId: dc.cardId ?? null,
        uniqueCardId: dc.uniqueCardId ?? null,
        quantity: dc.quantity,
      })),
    }

    if (initialDeck) {
      await fetch(`/api/decks/${initialDeck.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } else {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.deck?.id) {
        startTransition(() => router.push(`/decks/${data.deck.id}/edit`))
        setSaving(false)
        return
      }
    }

    setSaving(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Input
            placeholder="Nome do deck"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sm:w-64"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="sm:w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPublic(!isPublic)}>
            {isPublic ? "Público" : "Privado"}
          </Button>
          {isPublic && shareUrl && (
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <CheckIcon className="size-4" /> : <LinkIcon className="size-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
          )}
          <Button onClick={save} disabled={saving || !name.trim() || !heroCardId}>
            <SaveIcon className="size-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: search + results */}
        <div className="space-y-4">
          {/* Hero selector */}
          <div>
            <p className="text-sm font-medium mb-2">Herói *</p>
            <Select value={heroCardId} onValueChange={setHeroCardId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Selecione um Herói" />
              </SelectTrigger>
              <SelectContent>
                {heroes.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name} ({h.faction})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Card search */}
          <div>
            <p className="text-sm font-medium mb-2">Adicionar cartas</p>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar carta por nome ou texto..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  const v = e.target.value
                  const t = setTimeout(() => searchCards(v), 300)
                  return () => clearTimeout(t)
                }}
                className="pl-9"
              />
            </div>

            {searching && <p className="text-sm text-muted-foreground mt-2">Buscando...</p>}

            {searchResults.length > 0 && (
              <div className="mt-2 rounded-lg border border-border divide-y divide-border max-h-72 overflow-y-auto">
                {searchResults.map((card) => {
                  const variants = card.variants as Variant[] | null
                  const img = variants?.[0]?.imageUrl
                  return (
                    <div key={card.id} className="flex items-center gap-3 p-2 hover:bg-accent">
                      <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-muted">
                        {img && <img src={img} alt={card.name} className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{card.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          <Badge variant="outline" className="text-xs px-1 py-0">{card.faction}</Badge>
                          <Badge variant="outline" className="text-xs px-1 py-0">{card.rarity}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => addCard(card)}>
                        <PlusIcon className="size-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: deck list + validation */}
        <div className="space-y-4">
          {/* Validation panel */}
          <div className={`rounded-lg border p-3 ${validation.valid ? "border-green-600/30 bg-green-950/20" : "border-yellow-600/30 bg-yellow-950/20"}`}>
            <div className="flex items-center gap-2 mb-2">
              {validation.valid
                ? <CheckCircleIcon className="size-4 text-green-500" />
                : <AlertTriangleIcon className="size-4 text-yellow-500" />}
              <span className="text-sm font-medium">
                {validation.valid ? "Deck válido" : `${validation.errors.length} problema${validation.errors.length !== 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex gap-3 mb-2">
              <span>{validation.stats.total} cartas</span>
              <span>{validation.stats.rares} Rares</span>
              <span>{validation.stats.uniques} Uniques</span>
            </div>
            {validation.errors.map((e) => (
              <p key={e.rule} className="text-xs text-yellow-400 mt-1">{e.message}</p>
            ))}
          </div>

          {/* Deck card list */}
          <div className="rounded-lg border border-border divide-y divide-border max-h-[500px] overflow-y-auto">
            {deckCards.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma carta adicionada</p>
            ) : (
              deckCards.map((dc) => {
                const card = dc.card
                if (!card) return null
                return (
                  <div key={dc.cardId} className="flex items-center gap-2 p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground">{card.faction} · {card.rarity}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeCard(card.id)}>
                        <MinusIcon className="size-3" />
                      </Button>
                      <span className="text-sm w-4 text-center">{dc.quantity}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => addCard(card)}>
                        <PlusIcon className="size-3" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
