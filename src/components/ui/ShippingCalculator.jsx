import { useState, useMemo } from 'react'
import { Calculator, Info } from 'lucide-react'
import { quoteShipping, TARIFAS } from '../../lib/shipping'
import { formatUSD } from '../../lib/format'

/**
 * Calculadora estimativa. Muestra por separado: producto (se paga en la tienda),
 * comisión y envío (se pagan a Optimus) y deja la aduana de Cuba aparte.
 * Si no hay peso, no calcula un total: pide cotización.
 */
export default function ShippingCalculator({ value = '', weightKg = '', editableValue = false, compact = false }) {
  const [val, setVal] = useState(value === '' ? '' : String(value))
  const [kg, setKg] = useState(weightKg === '' || weightKg == null ? '' : String(weightKg))

  const quote = useMemo(
    () => quoteShipping({ value: parseFloat(val), weightKg: parseFloat(kg) }),
    [val, kg],
  )
  const hasValue = parseFloat(val) > 0

  return (
    <div className="card-surface rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={16} className="text-[var(--brand-text)]" />
        <h3 className="font-display font-extrabold text-[15px] text-[var(--fg-1)]">Calculá tu envío a Cuba</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field
          id="calc-value"
          label="Valor de productos (USD)"
          value={val}
          onChange={setVal}
          readOnly={!editableValue}
          placeholder="0.00"
        />
        <Field id="calc-kg" label="Peso estimado (kg)" value={kg} onChange={setKg} placeholder="Ej: 5" />
      </div>

      <div className="space-y-2 py-3 border-y border-[var(--bd-1)]">
        <Row label="Producto (se paga en la tienda)" value={hasValue ? formatUSD(quote.productValue) : '—'} muted />
        <Row label={`Comisión de gestión (${TARIFAS.commissionRate * 100}%)`} value={hasValue ? formatUSD(quote.commission) : '—'} />
        <Row
          label={quote.needsQuote ? 'Envío' : `Envío (${quote.weightKg} kg × ${formatUSD(TARIFAS.sellRatePerKg)}/kg)`}
          value={quote.needsQuote ? 'A cotizar' : formatUSD(quote.shipping)}
        />
      </div>

      <div className="flex items-end justify-between pt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-4)]">Pagás a Optimus</div>
        <div className="font-display font-black text-2xl text-[var(--brand-text)]">
          {quote.needsQuote ? 'Pedí cotización' : formatUSD(quote.optimusTotal)}
        </div>
      </div>

      {!quote.needsQuote && hasValue && (
        <div className="flex items-center justify-between mt-2 text-[12.5px] text-[var(--fg-3)]">
          <span>Desembolso total (tienda + Optimus)</span>
          <span className="font-semibold tabular-nums text-[var(--fg-2)]">{formatUSD(quote.grandTotal)}</span>
        </div>
      )}

      {!compact && (
        <ul className="mt-4 space-y-1.5 text-[11.5px] text-[var(--fg-4)] leading-relaxed">
          <li className="flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            Es una estimación. El total final lo emite Optimus en la liquidación, con el peso real.
          </li>
          <li className="flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            La aduana de Cuba no está incluida: la paga el destinatario al recibir.
          </li>
          <li className="flex items-start gap-1.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            Tarifa de referencia; los cargos por batería, volumen y peso mínimo se confirman al cotizar.
          </li>
        </ul>
      )}
    </div>
  )
}

function Field({ id, label, value, onChange, readOnly, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-4)] mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[14px] text-[var(--fg-1)] outline-none focus:border-[var(--color-brand)] read-only:opacity-70 tabular-nums"
      />
    </div>
  )
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-[var(--fg-3)]">{label}</span>
      <span className={`font-semibold tabular-nums ${muted ? 'text-[var(--fg-3)]' : 'text-[var(--fg-1)]'}`}>{value}</span>
    </div>
  )
}
