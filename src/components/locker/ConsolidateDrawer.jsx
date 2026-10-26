import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Package, Scale, Receipt, CheckCircle2, AlertCircle } from 'lucide-react'
import { createShipmentFromPackages } from '../../lib/locker'
import { quoteShipping, TARIFAS } from '../../lib/shipping'
import { formatUSD } from '../../lib/format'
import Button from '../ui/Button'


import { readable } from '../../lib/contrast'
export default function ConsolidateDrawer({ open, packages, onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false)

  const quote = useMemo(() => {
    if (!packages.length) return null
    const round2 = (n) => Math.round(n * 100) / 100
    const weightKg = round2(packages.reduce((s, p) => s + p.weightKg, 0))
    const value = round2(packages.reduce((s, p) => s + p.declaredValue, 0))
    return { weightKg, value, ...quoteShipping({ value, weightKg }) }
  }, [packages])

  function handleConfirm() {
    if (!packages.length || !quote) return
    const shipment = createShipmentFromPackages(packages)
    setConfirmed(true)
    setTimeout(() => { setConfirmed(false); onConfirm?.(shipment) }, 2500)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consolidate-title"
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--bg-base)] border-l border-[var(--bd-2)] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--bd-1)]">
              <div>
                <h2 id="consolidate-title" className="font-display font-extrabold text-[17px] text-[var(--fg-1)]">Solicitar liquidación</h2>
                <p className="text-[12.5px] text-[var(--fg-3)] mt-0.5">{packages.length} paquete{packages.length !== 1 ? 's' : ''} seleccionado{packages.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 rounded-lg border border-[var(--bd-2)] flex items-center justify-center text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors cursor-pointer">
                <X size={17} strokeWidth={1.5} />
              </button>
            </div>

            <div tabIndex={0} aria-label="Detalle de la liquidación" className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {confirmed ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4 py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-[#22C55E]/[0.12] flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-[var(--ok-text)]" />
                  </div>
                  <p className="text-[16px] font-bold text-[var(--fg-1)]">¡Liquidación solicitada!</p>
                  <p className="text-[13px] text-[var(--fg-3)]">Pagás en la sucursal. Con el pago confirmado se habilita el despacho.</p>
                </motion.div>
              ) : (
                <>
                  {/* Lista de paquetes */}
                  <section>
                    <h3 className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide mb-3">Paquetes incluidos</h3>
                    <div className="space-y-2">
                      {packages.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bd-1)]">
                          <Package size={15} className="text-[var(--fg-3)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[var(--fg-1)] truncate">{p.description}</p>
                            <p className="text-[11.5px] text-[var(--fg-4)]">{p.store} · {p.weightKg} kg · {formatUSD(p.declaredValue)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {quote && (
                    <section className="rounded-xl border border-[var(--bd-2)] p-4 space-y-3">
                      <h3 className="text-[12px] font-bold text-[var(--fg-3)] uppercase tracking-wide flex items-center gap-1.5">
                        <Scale size={13} /> Peso facturable
                      </h3>
                      <Row label="Peso total registrado" value={`${quote.weightKg} kg`} bold />
                    </section>
                  )}

                  {quote && (
                    <section className="rounded-xl border border-[var(--bd-2)] p-4 space-y-3">
                      <h3 className="text-[12px] font-bold text-[var(--fg-3)] uppercase tracking-wide flex items-center gap-1.5">
                        <Receipt size={13} /> Liquidación estimada
                      </h3>
                      <div className="space-y-2">
                        <Row label="Producto (pagado en la tienda)" value={formatUSD(quote.productValue)} />
                        <Row label={`Comisión (${TARIFAS.commissionRate * 100}% de ${formatUSD(quote.productValue)})`} value={formatUSD(quote.commission)} />
                        <Row label={`Envío (${quote.weightKg} kg × ${formatUSD(TARIFAS.sellRatePerKg)}/kg)`} value={quote.needsQuote ? 'A cotizar' : formatUSD(quote.shipping)} />
                        <div className="h-px bg-[var(--bd-2)]" />
                        <Row label="Total a pagar a Optimus" value={quote.needsQuote ? '—' : formatUSD(quote.optimusTotal)} bold />
                      </div>
                    </section>
                  )}

                  <div className="flex gap-2.5 p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--bd-2)]">
                    <AlertCircle size={15} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[var(--fg-2)] leading-relaxed">
                      El pago es presencial en la sucursal, no en la web. La aduana de Cuba no está incluida: la paga el destinatario al recibir. El total final lo confirma Optimus con el peso real.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!confirmed && (
              <div className="px-6 py-5 border-t border-[var(--bd-1)] space-y-3">
                {quote && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--fg-3)]">Pagás a Optimus</span>
                    <span className="text-[20px] font-display font-black text-[var(--fg-1)]">{quote.needsQuote ? '—' : formatUSD(quote.optimusTotal)}</span>
                  </div>
                )}
                <Button onClick={handleConfirm} disabled={!packages.length} className="w-full gap-2">
                  <Receipt size={16} /> Solicitar liquidación
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Row({ label, value, bold, accent }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[13px] ${bold ? 'font-semibold text-[var(--fg-1)]' : 'text-[var(--fg-3)]'}`}>{label}</span>
      <span className={`text-[13px] font-semibold ${bold ? 'text-[var(--fg-1)]' : ''}`} style={accent ? { color: readable(accent) } : {}}>{value}</span>
    </div>
  )
}
