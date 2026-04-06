export default function DecksLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded bg-muted" />
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 flex flex-col gap-3">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
            <div className="flex gap-2 mt-auto">
              <div className="h-8 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
