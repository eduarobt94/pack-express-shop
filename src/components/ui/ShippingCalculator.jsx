import { useState, useMemo } from 'react'
import { MapPin, Ship, Plane, Info } from 'lucide-react'
import { departmentsUY, quoteShipping } from '../../lib/shipping'
import { formatUSD } from '../../lib/format'

export default function ShippingCalculator({ value, weightKg, compact = false }) {
  const [province, setProvince] = useState('MVD')
  const [method, setMethod] = useState('standard')

  const quote = useMemo(
    () => quoteShipping({ weightKg, value, provinceCode: province, method }),
    [weightKg, value, province, method],
  )

  return (
    <div className="card-surface rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={16} className="text-[#E31E24]" />
        <h3 className="font-display font-semibold text-[15px] text-[var(--fg-1)]">Calculá tu envío a Uruguay</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="calc-prov" className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-4)] mb-1.5">Departamento</label>
          <select
            id="calc-prov"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--bd-2)] bg-[var(--bg-elevated)] text-[13px] text-[var(--fg-1)] outline-none cursor-pointer focus:border-[#E31E24]/50"
          >
            {departmentsUY.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-4)] mb-1.5">Método</span>
          <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bd-2)]">
            {[{ id: 'standard', Icon: Ship }, { id: 'express', Icon: Plane }].map(({ id, Icon }) => (
              <button
                key={id}
                onClick={() => setMethod(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-colors cursor-pointer ${
                  method === id ? 'bg-[#E31E24] text-white' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
                }`}
              >
                <Icon size={13} /> {id === 'standard' ? 'Estándar' : 'Express'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 py-3 border-y border-[var(--bd-1)]">
        <Row label="Precio del producto" value={formatUSD(value)} />
        <Row label="Flete internacional" value={formatUSD(quote.freight)} />
        <Row label="Impuestos estimados" value={formatUSD(quote.customs)} hint />
        <Row label="Gestión logística" value={formatUSD(quote.handling)} />
      </div>

      <div className="flex items-end justify-between pt-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-4)]">Total en Uruguay</div>
          <div className="text-[11px] text-[#22C55E] mt-0.5">Entrega en {quote.eta} días</div>
        </div>
        <div className="font-display font-extrabold text-2xl text-[#E31E24]">{formatUSD(value + quote.total)}</div>
      </div>

      {!compact && (
        <p className="flex items-start gap-1.5 mt-4 text-[11.5px] text-[var(--fg-4)] leading-relaxed">
          <Info size={13} className="shrink-0 mt-0.5" />
          Los impuestos son estimados. Si hay diferencia en el despacho, te avisamos antes de proceder.
        </p>
      )}
    </div>
  )
}

function Row({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-[var(--fg-3)] flex items-center gap-1">
        {label}
        {hint && <Info size={11} className="text-[var(--fg-5)]" />}
      </span>
      <span className="font-semibold text-[var(--fg-1)] tabular-nums">{value}</span>
    </div>
  )
}
