export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />
}

export function ProductCardSkeleton() {
  return (
    <div className="card-surface rounded-2xl overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
