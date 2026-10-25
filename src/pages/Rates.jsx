import { Info } from 'lucide-react'
import ShippingCalculator from '../components/ui/ShippingCalculator'
import { TARIFAS } from '../lib/shipping'
import { formatUSD } from '../lib/format'

const NOTES = [
  'La aduana de Cuba no está incluida: la paga el destinatario al recibir.',
  'Si todavía no se conoce el peso, pedimos cotización: no calculamos un total inventado.',
  'Peso mínimo, redondeo, volumen y cargos por batería se confirman al cotizar.',
  'Cualquier cargo extraordinario se informa y se aprueba antes de cobrarlo.',
]

export default function Rates() {
  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
      <h1 className="font-display font-black text-[clamp(1.75rem,4vw,3rem)] text-[var(--fg-1)] leading-tight mb-2">Tarifas y calculadora</h1>
      <p className="font-display italic font-light text-[18px] text-[var(--fg-3)] mb-10">Cero vueltas: así es el precio.</p>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div className="card-surface rounded-xl p-6">
            <h2 className="font-display font-extrabold text-[17px] text-[var(--fg-1)] mb-4">Qué le pagás a Optimus</h2>
            <dl className="space-y-3 text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fg-3)]">Comisión de gestión</dt>
                <dd className="font-bold text-[var(--fg-1)] text-right">{TARIFAS.commissionRate * 100}% del valor de los productos</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fg-3)]">Envío</dt>
                <dd className="font-bold text-[var(--fg-1)] text-right">kg facturables × {formatUSD(TARIFAS.sellRatePerKg)}/kg *</dd>
              </div>
            </dl>
            <p className="text-[12px] text-[var(--fg-4)] mt-4 leading-relaxed">
              * Tarifa de referencia, no es un precio definitivo. Optimus confirma la vigente al cotizar.
            </p>
          </div>

          <div className="card-surface rounded-xl p-6">
            <h2 className="font-display font-extrabold text-[17px] text-[var(--fg-1)] mb-3">Ejemplo</h2>
            <p className="text-[13.5px] text-[var(--fg-2)] leading-relaxed">
              Comprás por <strong>USD 100</strong> y enviás <strong>5 kg</strong>: comisión USD 10 + envío USD 55 ={' '}
              <strong className="text-[#E31E24]">USD 65 a Optimus</strong>. El producto lo pagás aparte, en la tienda.
            </p>
          </div>

          <ul className="space-y-2 text-[12.5px] text-[var(--fg-3)] leading-relaxed">
            {NOTES.map((t) => (
              <li key={t} className="flex gap-2">
                <Info size={14} className="shrink-0 mt-0.5 text-[var(--fg-4)]" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <ShippingCalculator editableValue />
      </div>
    </div>
  )
}
