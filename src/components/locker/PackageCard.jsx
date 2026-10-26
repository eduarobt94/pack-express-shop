import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { PACKAGE_STATES } from '../../lib/locker'
import { formatUSD, formatDate } from '../../lib/format'
import { readable } from '../../lib/contrast'

/**
 * Tarjeta de paquete: línea fina, estado como punto de color + texto, selección con borde de tinta (no con relleno de marca).
 * En modo seleccionable los paquetes listos funcionan como casilla accesible (rol checkbox, teclado Espacio/Enter).
 */
export default function PackageCard({ pkg, selected, onSelect, selectable }) {
  const meta = PACKAGE_STATES[pkg.status]
  const interactive = selectable && pkg.status === 'ready'

  function onKeyDown(e) {
    if (!interactive) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onSelect?.(pkg.id)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onClick={selectable ? () => onSelect?.(pkg.id) : undefined}
      onKeyDown={onKeyDown}
      role={interactive ? 'checkbox' : undefined}
      aria-checked={interactive ? Boolean(selected) : undefined}
      aria-label={interactive ? `Seleccionar paquete ${pkg.description}` : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`relative rounded-xl border p-5 transition-[border-color,box-shadow] duration-300 ${
        selected
          ? 'border-[var(--fg-1)] bg-[var(--bg-base)] shadow-[var(--shadow-hover)]'
          : 'border-[var(--bd-2)] bg-[var(--bg-base)] hover:border-[var(--bd-3)]'
      } ${selectable ? 'cursor-pointer' : ''} ${selectable && pkg.status !== 'ready' ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {interactive && (
        <div
          aria-hidden="true"
          className={`absolute top-5 right-5 w-5 h-5 rounded-full border transition-colors duration-300 flex items-center justify-center ${
            selected ? 'bg-[var(--fg-1)] border-[var(--fg-1)]' : 'border-[var(--bd-3)]'
          }`}
        >
          {selected && <span className="text-[var(--bg-base)] text-[10px] font-bold">✓</span>}
        </div>
      )}

      <div className="min-w-0 pr-8">
        <p className="inline-flex items-center gap-2 text-[12px] font-medium" style={{ color: readable(meta.color) }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
          {meta.label}
        </p>

        <p className="mt-2 text-[15px] font-semibold text-[var(--fg-1)] truncate">{pkg.description}</p>
        <p className="text-[13px] text-[var(--fg-3)] mt-0.5">{pkg.store} · #{pkg.trackingNumber.slice(-8)}</p>

        <div className="flex items-center gap-x-5 gap-y-1 mt-3 flex-wrap">
          <span className="text-[13px] text-[var(--fg-3)] tabular-nums">{pkg.weightKg} kg</span>
          <span className="text-[13px] font-semibold text-[var(--fg-2)] tabular-nums">{formatUSD(pkg.declaredValue)}</span>
          <span className="text-[12px] text-[var(--fg-4)]">Recibido {formatDate(pkg.receivedAt)}</span>
        </div>

        {pkg.notes.length > 0 && (
          <p className="mt-3 text-[12.5px] leading-snug text-[var(--warn-text)]">{pkg.notes[0]}</p>
        )}

        {pkg.retainedReason && (
          <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--err-text)]">
            <AlertTriangle size={13} strokeWidth={1.5} className="shrink-0 mt-[2px]" aria-hidden="true" />
            {pkg.retainedReason}
          </p>
        )}
      </div>
    </motion.div>
  )
}
