import * as Icons from 'lucide-react'

/**
 * Visual de producto generado por marca (sin assets externos).
 * Combina un degradado sutil con el icono del producto + patrón de puntos.
 */
export default function ProductVisual({ icon = 'Package', tint = '#E31E24', size = 'md', className = '' }) {
  const Icon = Icons[icon] || Icons.Package
  const iconSize = size === 'lg' ? 96 : size === 'sm' ? 34 : 58

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
      style={{
        background: `radial-gradient(120% 120% at 30% 0%, ${tint}22 0%, transparent 55%), var(--bg-elevated)`,
      }}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 w-full h-full opacity-[0.5]" aria-hidden="true">
        <defs>
          <pattern id={`dots-${tint.slice(1)}`} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="11" cy="11" r="1" fill="var(--fg-1)" opacity="0.06" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dots-${tint.slice(1)})`} />
      </svg>
      <div
        className="absolute -inset-8 blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle at 50% 40%, ${tint}, transparent 60%)` }}
      />
      <Icon size={iconSize} strokeWidth={1.25} style={{ color: tint }} className="relative z-10 drop-shadow-lg" />
    </div>
  )
}
