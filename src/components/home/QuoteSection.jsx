import { Link } from 'react-router-dom'
import ShippingCalculator from '../ui/ShippingCalculator'
import { Section } from '../ui/Layout'
import { TARIFAS } from '../../lib/shipping'
import { formatUSD } from '../../lib/format'

/** Cotizador en la portada: responde "¿cuánto me cuesta?" sin salir de la página. */
export default function QuoteSection() {
  return (
    <Section id="cotizador" tone="alt" className="scroll-mt-24">
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        <div className="lg:col-span-6">
          <p className="eyebrow mb-5">Tarifas</p>
          <h2 className="title-xl text-[var(--fg-1)] whitespace-nowrap !text-[clamp(1.375rem,6.2vw,2.5rem)]">¿Cuánto cuesta enviar?</h2>
          <dl className="mt-10 border-t border-[var(--bd-2)] divide-y divide-[var(--bd-1)]">
            <div className="py-4 flex justify-between gap-6">
              <dt className="text-[15px] text-[var(--fg-3)]">Comisión</dt>
              <dd className="font-display font-extrabold text-[var(--fg-1)]">{TARIFAS.commissionRate * 100}&nbsp;% del producto</dd>
            </div>
            <div className="py-4 flex justify-between gap-6">
              <dt className="text-[15px] text-[var(--fg-3)]">Envío</dt>
              <dd className="font-display font-extrabold text-[var(--fg-1)]">{formatUSD(TARIFAS.sellRatePerKg)}/kg *</dd>
            </div>
            <div className="py-4 flex justify-between gap-6">
              <dt className="text-[15px] text-[var(--fg-3)]">Aduana de Cuba</dt>
              <dd className="font-display font-extrabold text-[var(--fg-1)]">La paga quien recibe</dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] leading-[1.7] text-[var(--fg-4)]">* Tarifa de referencia; Optimus confirma la vigente al cotizar.</p>
          <Link to="/tarifas" className="link-arrow mt-8">Ver todas las tarifas</Link>
        </div>

        <div className="lg:col-span-6">
          <ShippingCalculator value="100" weightKg="5" editableValue compact />
        </div>
      </div>
    </Section>
  )
}
