import { motion } from 'framer-motion'
import { PackageCheck, FileWarning, ScanSearch, PackagePlus, Plane, ShieldCheck, Clock, AlertTriangle } from 'lucide-react'
import { PACKAGE_STATES, storageInfo, FREE_STORAGE_DAYS } from '../../lib/locker'
import { formatUSD, formatDate } from '../../lib/format'

const STATE_ICONS = { PackageCheck, FileWarning, ScanSearch, PackagePlus, Plane, AlertTriangle }

export default function PackageCard({ pkg, selected, onSelect, selectable }) {
  const meta = PACKAGE_STATES[pkg.status]
  const Icon = STATE_ICONS[meta.icon] || PackageCheck
  const { daysLeft, daysInStorage, extraCost } = storageInfo(pkg.receivedAt)
  const storageWarning = daysLeft <= 10 && pkg.status !== 'shipped'
  const storageExpired = daysLeft === 0 && pkg.status !== 'shipped'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onClick={selectable ? () => onSelect?.(pkg.id) : undefined}
      className={`relative rounded-2xl border p-4 transition-all cursor-pointer ${
        selected
          ? 'border-[#F07232] bg-[#F07232]/[0.05] shadow-[0_0_0_2px_rgba(240,114,50,0.18)]'
          : 'border-[var(--bd-2)] bg-[var(--bg-card)] hover:border-[var(--bd-3)]'
      } ${selectable && pkg.status !== 'ready' ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Checkbox (selectable mode) */}
      {selectable && pkg.status === 'ready' && (
        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
          selected ? 'bg-[#F07232] border-[#F07232]' : 'border-[var(--bd-3)]'
        }`}>
          {selected && <span className="text-white text-[10px] font-bold">✓</span>}
        </div>
      )}

      <div className="flex gap-3 items-start">
        {/* Estado icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}18` }}>
          <Icon size={18} style={{ color: meta.color }} />
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${meta.color}18`, color: meta.color }}>
              {meta.label}
            </span>
            {pkg.insured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#22C55E]/[0.10] text-[#22C55E]">
                <ShieldCheck size={10} /> Asegurado
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[14px] font-semibold text-[var(--fg-1)] truncate">{pkg.description}</p>
          <p className="text-[12.5px] text-[var(--fg-3)] mt-0.5">{pkg.store} · #{pkg.trackingNumber.slice(-8)}</p>

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-[12.5px] text-[var(--fg-3)]">{pkg.weightKg} kg</span>
            <span className="text-[12.5px] font-semibold text-[var(--fg-2)]">{formatUSD(pkg.declaredValue)}</span>
            <span className="text-[12px] text-[var(--fg-4)]">Recibido {formatDate(pkg.receivedAt)}</span>
          </div>

          {/* Countdown almacenaje */}
          {pkg.status !== 'shipped' && (
            <div className={`mt-2.5 flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-2.5 py-1.5 w-fit ${
              storageExpired
                ? 'bg-[#EF4444]/[0.10] text-[#EF4444]'
                : storageWarning
                ? 'bg-[#F5A524]/[0.10] text-[#F5A524]'
                : 'bg-[var(--bd-1)] text-[var(--fg-3)]'
            }`}>
              <Clock size={12} />
              {storageExpired
                ? `Almacenaje vencido · +${formatUSD(extraCost)}`
                : `${daysLeft} días de almacenaje gratis (${daysInStorage}/${FREE_STORAGE_DAYS})`}
            </div>
          )}

          {/* Nota del almacén */}
          {pkg.notes.length > 0 && (
            <p className="mt-2 text-[12px] text-[#F5A524] bg-[#F5A524]/[0.08] rounded-lg px-2.5 py-1.5">
              {pkg.notes[0]}
            </p>
          )}

          {/* Razón de retención */}
          {pkg.retainedReason && (
            <div className="mt-2 flex items-start gap-1.5 text-[12px] text-[#EF4444] bg-[#EF4444]/[0.08] rounded-lg px-2.5 py-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {pkg.retainedReason}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
