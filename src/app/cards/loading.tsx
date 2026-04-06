export default function CardsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-6 flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
