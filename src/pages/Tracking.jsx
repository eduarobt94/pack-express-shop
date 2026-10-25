import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { Search, MapPin, Package, Plane, Clock, Check } from 'lucide-react'
import { getTracking } from '../data/tracking'
import { formatDateTime } from '../lib/format'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

export default function Tracking() {
  const { order } = useParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState(order || '')
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (order) doSearch(order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  function doSearch(value) {
    const v = (value ?? query).trim()
    if (!v) return
    setLoading(true)
    setSearched(true)
    setTimeout(() => {
      setResult(getTracking(v) || null)
      setLoading(false)
    }, 700)
  }

  function onSubmit(e) {
    e.preventDefault()
    if (query.trim()) navigate(`/seguimiento/${encodeURIComponent(query.trim())}`)
    doSearch()
  }

  return (
    <div className="pt-0">
      {/* Hero search */}
      <div className="border-b border-[var(--bd-1)] bg-[var(--bg-alt)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 80% at 50% -20%, rgba(227,30,36,0.08), transparent 60%)' }} />
        <div className="relative max-w-2xl mx-auto px-5 sm:px-8 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E31E24]/[0.12] border border-[#E31E24]/25 flex items-center justify-center mx-auto mb-5">
            <MapPin size={26} className="text-[#E31E24]" />
          </div>
          <h1 className="font-display font-extrabold text-[clamp(1.6rem,4vw,2.25rem)] text-[var(--fg-1)] mb-2">Rastrea tu pedido</h1>
          <p className="text-[14.5px] text-[var(--fg-3)] mb-7">Ingresa tu número de orden para ver el estado en tiempo real.</p>

          <form onSubmit={onSubmit} className="flex items-center gap-2 p-1.5 bg-[var(--bg-card)] border border-[var(--bd-2)] rounded-2xl focus-within:border-[#E31E24]/50 focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all">
            <div className="flex items-center flex-1 pl-3">
              <Search size={17} className="text-[var(--fg-4)] shrink-0" />
              <label htmlFor="track" className="sr-only">Número de orden</label>
              <input
                id="track"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                placeholder="Ej: OPT-MVD-2026-00847"
                className="flex-1 bg-transparent text-[14px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none px-3 py-2.5 min-w-0"
              />
            </div>
            <button type="submit" className="px-6 py-2.5 bg-[#E31E24] hover:bg-[#C81A1F] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">Rastrear</button>
          </form>
          <p className="text-[12px] text-[var(--fg-4)] mt-3">Prueba con: OPT-MVD-2026-00847 o OPT-CAN-2026-00692</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--bd-3)] border-t-[#E31E24] animate-spin mb-4" />
            <p className="text-[13.5px] text-[var(--fg-3)]">Buscando tu pedido...</p>
          </div>
        ) : searched && !result ? (
          <EmptyState
            icon="PackageSearch"
            title="No encontramos ese pedido"
            description="Verifica el número de orden e inténtalo de nuevo. Lo encuentras en tu email de confirmación."
            action={<Button variant="subtle" onClick={() => { setQuery(''); setSearched(false) }}>Intentar de nuevo</Button>}
          />
        ) : result ? (
          <TrackingResult data={result} />
        ) : (
          <div className="text-center py-10">
            <Package size={40} className="text-[var(--bd-4)] mx-auto mb-3" />
            <p className="text-[13.5px] text-[var(--fg-4)]">Ingresa un número de orden para comenzar.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TrackingResult({ data }) {
  const progress = (data.currentStep / (data.steps.length - 1)) * 100
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      {/* Summary header */}
      <div className="card-surface rounded-2xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[var(--fg-4)] font-semibold">Orden</span>
            <h2 className="font-display font-extrabold text-lg text-[var(--fg-1)]">{data.order}</h2>
            <p className="text-[13px] text-[var(--fg-3)] mt-0.5">{data.product}</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E31E24]/[0.12] border border-[#E31E24]/25 text-[12px] font-semibold text-[#E31E24]">
              <Plane size={13} /> En camino
            </span>
            <p className="text-[12px] text-[var(--fg-3)] mt-2">Entrega est: <span className="font-semibold text-[#22C55E]">{data.eta}</span></p>
          </div>
        </div>

        {/* Current location */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--sec)]/[0.07] border border-[var(--sec)]/20">
          <MapPin size={18} className="text-[var(--sec)] shrink-0" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--fg-4)] font-semibold">Ubicación actual</div>
            <div className="text-[13.5px] font-medium text-[var(--fg-1)]">{data.location}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="h-2 rounded-full bg-[var(--bd-1)] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-gradient-to-r from-[#E31E24] to-[#C81A1F]" />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-[var(--fg-4)]">
            <span>EE.UU.</span><span>Aduana UY</span><span>Entrega</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card-surface rounded-2xl p-6 mb-5">
        <h3 className="font-display font-bold text-[15px] text-[var(--fg-1)] mb-5">Estado del envío</h3>
        <ol className="relative">
          {data.steps.map((s, i) => {
            const last = i === data.steps.length - 1
            return (
              <li key={s.key} className="flex gap-4 pb-6 last:pb-0 relative">
                {!last && <span className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${s.done ? 'bg-[#22C55E]' : 'bg-[var(--bd-2)]'}`} />}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    s.done ? 'bg-[#22C55E] text-white' : s.active ? 'bg-[#E31E24] text-white' : 'bg-[var(--bg-elevated)] border-2 border-[var(--bd-3)] text-[var(--fg-4)]'
                  }`}
                >
                  {s.done ? <Check size={16} /> : s.active ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  ) : <span className="w-2 h-2 rounded-full bg-[var(--bd-4)]" />}
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-[14px] font-semibold ${s.done || s.active ? 'text-[var(--fg-1)]' : 'text-[var(--fg-4)]'}`}>{s.label}</h4>
                    {s.date && <span className="text-[11.5px] text-[var(--fg-4)] shrink-0">{formatDateTime(s.date)}</span>}
                  </div>
                  <p className={`text-[12.5px] mt-0.5 ${s.active ? 'text-[#E31E24]' : 'text-[var(--fg-3)]'}`}>{s.desc}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* History */}
      <div className="card-surface rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-[var(--fg-3)]" />
          <h3 className="font-display font-bold text-[15px] text-[var(--fg-1)]">Historial de movimientos</h3>
        </div>
        <ul className="space-y-3">
          {data.history.map((h) => {
            const Icon = Icons[h.icon] || Package
            return (
              <li key={h.date} className="flex items-center gap-3 text-[13px]">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bd-1)] flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-[var(--fg-3)]" />
                </div>
                <span className="flex-1 text-[var(--fg-2)]">{h.text}</span>
                <span className="text-[11.5px] text-[var(--fg-4)] shrink-0">{formatDateTime(h.date)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </motion.div>
  )
}
