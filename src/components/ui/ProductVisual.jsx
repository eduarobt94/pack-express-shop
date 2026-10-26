import * as Icons from 'lucide-react'

/**
 * Visual de producto generado por marca (sin fotografías): papel cálido, patrón diagonal a 45° del isotipo (Manual §13)
 * y el ícono en trazo fino. Sin degradados de color ni brillos: la imagen es silenciosa para que el producto hable.
 * `tint` se acepta por compatibilidad con los datos y ya no tiñe la imagen.
 * NOTA: cuando Optimus entregue fotografía autorizada (Manual §15), este componente es el único punto a reemplazar.
 */
export default function ProductVisual({ icon = 'Package', size = 'md', className = '' }) {
  const Icon = Icons[icon] || Icons.Package
  const iconSize = size === 'lg' ? 112 : size === 'sm' ? 36 : 64

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center bg-[var(--bg-alt)] ${className}`}
      aria-hidden="true"
    >
      <div className="pattern-diagonal absolute inset-0" />
      <Icon size={iconSize} strokeWidth={0.9} className="relative z-10 text-[var(--fg-1)] opacity-80" />
    </div>
  )
}
