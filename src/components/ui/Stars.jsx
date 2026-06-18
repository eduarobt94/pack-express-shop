import { Star } from 'lucide-react'

export default function Stars({ rating, size = 13, showValue = false }) {
  return (
    <div className="inline-flex items-center gap-1.5" aria-label={`Calificación ${rating} de 5`}>
      <div className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={size}
            className="shrink-0"
            style={{
              color: i <= Math.round(rating) ? '#F5A524' : 'var(--bd-4)',
              fill: i <= Math.round(rating) ? '#F5A524' : 'transparent',
            }}
          />
        ))}
      </div>
      {showValue && <span className="text-xs font-semibold text-[var(--fg-2)]">{rating.toFixed(1)}</span>}
    </div>
  )
}
