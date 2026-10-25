import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Package, Scale, Ruler, ShieldCheck, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { quoteVolumetric, quoteByWeight, quoteInsurance, HANDLING_FEE, createShipmentFromPackages } from '../../lib/locker'
import { formatUSD } from '../../lib/format'
import Button from '../ui/Button'

export default function ConsolidateDrawer({ open, packages, onClose, onConfirm }) {
  const [insureAll, setInsureAll] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const quote = useMemo(() => {
    if (!packages.length) return null

    const totalWeightKg = packages.reduce((s, p) => s + p.weightKg, 0)
    const totalDeclaredValue = packages.reduce((s, p) => s + p.declaredValue, 0)
    const round2 = (n) => Math.round(n * 100) / 100

    const volumetricData = packages.map((p) => ({
      pkg: p,
      ...quoteVolumetric(p.dimensions, p.weightKg),
    }))
    const totalVolumetricExcess = round2(volumetricData.reduce((s, v) => s + v.excessKg, 0))
    const chargeableKg = round2(totalWeightKg + totalVolumetricExcess)
    const freight = quoteByWeight(chargeableKg)
    const insurance = insureAll ? quoteInsurance(totalDeclaredValue) : 0
    const total = round2(freight + HANDLING_FEE + insurance)

    return { totalWeightKg: round2(totalWeightKg), chargeableKg, freight, insurance, handling: HANDLING_FEE, total, totalDeclaredValue, volumetricData }
  }, [packages, insureAll])

  function handleConfirm() {
    if (!packages.length || !quote) return
    const shipment = createShipmentFromPackages(packages, { insureAll })
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
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--bg-base)] border-l border-[var(--bd-2)] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--bd-1)]">
              <div>
                <h2 className="font-display font-extrabold text-[17px] text-[var(--fg-1)]">Consolidar envío</h2>
                <p className="text-[12.5px] text-[var(--fg-3)] mt-0.5">{packages.length} paquete{packages.length !== 1 ? 's' : ''} seleccionado{packages.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-xl border border-[var(--bd-2)] flex items-center justify-center text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors cursor-pointer">
                <X size={17} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {confirmed ? (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4 py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-[#22C55E]/[0.12] flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-[#22C55E]" />
                  </div>
                  <p className="text-[16px] font-bold text-[var(--fg-1)]">¡Envío solicitado!</p>
                  <p className="text-[13px] text-[var(--fg-3)]">Recibirás confirmación por email y WhatsApp.</p>
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

                  {/* Peso real vs volumétrico */}
                  {quote && (
                    <section className="rounded-2xl border border-[var(--bd-2)] p-4 space-y-3">
                      <h3 className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide flex items-center gap-1.5">
                        <Scale size={13} /> Peso cobrable
                      </h3>
                      <div className="space-y-2">
                        <Row label="Peso real total" value={`${quote.totalWeightKg} kg`} />
                        {quote.volumetricData.filter(v => v.excessKg > 0).map(v => (
                          <div key={v.pkg.id} className="flex items-start gap-2 text-[12px] text-[#F5A524]">
                            <Ruler size={12} className="mt-0.5 shrink-0" />
                            <span>{v.pkg.description.slice(0, 30)}… — +{v.excessKg} kg volumétrico</span>
                          </div>
                        ))}
                        <Row label="Peso cobrable" value={`${quote.chargeableKg} kg`} bold />
                      </div>
                    </section>
                  )}

                  {/* Desglose de costos */}
                  {quote && (
                    <section className="rounded-2xl border border-[var(--bd-2)] p-4 space-y-3">
                      <h3 className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide">Desglose de costos</h3>
                      <div className="space-y-2">
                        <Row label="Flete internacional" value={formatUSD(quote.freight)} />
                        <Row label="Manejo documentario" value={formatUSD(quote.handling)} />
                        {quote.insurance > 0 && <Row label="Seguro de transporte (3%)" value={formatUSD(quote.insurance)} accent="#22C55E" />}
                        <div className="h-px bg-[var(--bd-2)]" />
                        <Row label="Total" value={formatUSD(quote.total)} bold />
                      </div>
                    </section>
                  )}

                  {/* Opción de seguro */}
                  <button
                    type="button"
                    onClick={() => setInsureAll((v) => !v)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                      insureAll ? 'border-[#22C55E] bg-[#22C55E]/[0.06]' : 'border-[var(--bd-2)] bg-[var(--bg-card)]'
                    }`}
                  >
                    <ShieldCheck size={20} className={insureAll ? 'text-[#22C55E]' : 'text-[var(--fg-3)]'} />
                    <div className="flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--fg-1)]">Agregar seguro de transporte</p>
                      <p className="text-[12px] text-[var(--fg-3)]">3% del valor declarado ({formatUSD(quote?.totalDeclaredValue || 0)}) · mín. $33</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      insureAll ? 'border-[#22C55E] bg-[#22C55E]' : 'border-[var(--bd-3)]'
                    }`}>
                      {insureAll && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                  </button>

                  {/* Aviso franquicias */}
                  <div className="flex gap-2.5 p-3.5 rounded-xl bg-[var(--sec)]/[0.07] border border-[var(--sec)]/20">
                    <AlertCircle size={15} className="text-[var(--sec)] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[var(--fg-2)]">
                      El pago debe realizarse desde fuera de Uruguay. El destinatario solo confirma la recepción.
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
                    <span className="text-[13px] text-[var(--fg-3)]">Total del envío</span>
                    <span className="text-[20px] font-display font-extrabold text-[var(--fg-1)]">{formatUSD(quote.total)}</span>
                  </div>
                )}
                <Button onClick={handleConfirm} disabled={!packages.length} className="w-full gap-2">
                  <CreditCard size={16} /> Solicitar y pagar {quote ? formatUSD(quote.total) : ''}
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
      <span className={`text-[13px] font-semibold ${bold ? 'text-[var(--fg-1)]' : ''}`} style={accent ? { color: accent } : {}}>{value}</span>
    </div>
  )
}
