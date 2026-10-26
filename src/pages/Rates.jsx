import ShippingCalculator from '../components/ui/ShippingCalculator'
import { PageHeader, Section } from '../components/ui/Layout'
import { formatUSD } from '../lib/format'
import { TARIFAS } from '../lib/shipping'

const NOTES = [
  'La aduana de Cuba no está incluida: la paga el destinatario al recibir.',
  'Si todavía no se conoce el peso, pedimos cotización: no calculamos un total inventado.',
  'Peso mínimo, redondeo, volumen y cargos por batería se confirman al cotizar.',
  'Cualquier cargo extraordinario se informa y se aprueba antes de cobrarlo.',
]

export default function Rates() {
  return (
    <div>
      <PageHeader eyebrow="Tarifas" title="Tarifas y calculadora" lead="Cero vueltas: así es el precio." />

      <Section tight>
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-12 items-start">
          <div className="lg:col-span-6">
            <h2 className="title-lg text-[var(--fg-1)]">Qué le pagás a Optimus</h2>
            <dl className="mt-8 border-t border-[var(--bd-2)] divide-y divide-[var(--bd-1)]">
              <div className="py-5 flex justify-between gap-6">
                <dt className="text-[15px] text-[var(--fg-3)]">Comisión de gestión</dt>
                <dd className="font-display font-extrabold text-[1.0625rem] tracking-[-0.01em] text-[var(--fg-1)] text-right">{TARIFAS.commissionRate * 100}% del valor de los productos</dd>
              </div>
              <div className="py-5 flex justify-between gap-6">
                <dt className="text-[15px] text-[var(--fg-3)]">Envío</dt>
                <dd className="font-display font-extrabold text-[1.0625rem] tracking-[-0.01em] text-[var(--fg-1)] text-right">kg facturables × {formatUSD(TARIFAS.sellRatePerKg)}/kg *</dd>
              </div>
            </dl>
            <p className="mt-5 text-[13px] leading-[1.7] text-[var(--fg-4)]">
              * Tarifa de referencia, no es un precio definitivo. Optimus confirma la vigente al cotizar.
            </p>

            <h2 className="title-lg text-[var(--fg-1)] mt-16">Ejemplo</h2>
            <p className="prose-calm mt-5">
              Comprás por <strong className="text-[var(--fg-1)]">USD 100</strong> y enviás <strong className="text-[var(--fg-1)]">5 kg</strong>: comisión USD 10 + envío USD 55 ={' '}
              <strong className="text-[var(--brand-text)]">USD 65 a Optimus</strong>. El producto lo pagás aparte, en la tienda.
            </p>

            <ul className="mt-12 space-y-4 text-[14px] leading-[1.7] text-[var(--fg-3)]">
              {NOTES.map((t) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-[0.7em] w-1 h-1 rounded-full bg-[var(--color-brand)] shrink-0" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6 lg:sticky lg:top-28">
            <ShippingCalculator editableValue />
          </div>
        </div>
      </Section>
    </div>
  )
}
