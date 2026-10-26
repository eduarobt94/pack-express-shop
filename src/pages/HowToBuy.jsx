import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import { PageHeader, Reveal, Section, SectionHead } from '../components/ui/Layout'

const STEPS = [
  { title: 'Mirá cómo funciona', desc: 'Consultá cargos y restricciones antes de comprar.' },
  { title: 'Registrate', desc: 'Obtenés tu código personal y la dirección autorizada de recepción en EE.UU.' },
  { title: 'Comprá en la tienda', desc: 'Entrás desde Optimus, elegís y pagás el producto con tus propios medios.' },
  { title: 'Registrá la compra', desc: 'Cargás comprobante, productos, seguimiento y destinatario en Cuba. Es obligatorio.' },
  { title: 'Recibimos y pesamos', desc: 'Nuestro colaborador en EE.UU. confirma la recepción, pesa y carga fotos.' },
  { title: 'Pagás en la sucursal', desc: 'Emitimos la liquidación final. Un empleado registra y valida tu pago.' },
  { title: 'Despachamos', desc: 'Con el pago completo se despacha. Seguís el envío desde tu cuenta.' },
  { title: 'Entrega en Cuba', desc: 'Tu familiar recibe y paga la aduana en ese momento.' },
]

const WHO = [
  { who: 'A la tienda', what: 'El producto', note: 'Con tus tarjetas o medios de pago. Nunca te los pedimos.' },
  { who: 'A Optimus (sucursal en Uruguay)', what: 'Comisión de gestión + envío por kilo', note: 'Ver tarifas y calculadora.' },
  { who: 'En Cuba (quien recibe)', what: 'La aduana', note: 'No está incluida en lo que pagás a Optimus.' },
]

export default function HowToBuy() {
  return (
    <div>
      <PageHeader eyebrow="Paso a paso" title="Cómo comprar" lead="Ocho pasos, cero vueltas." />

      <Section tight>
        <ol className="grid md:grid-cols-2 md:gap-x-20 border-t border-[var(--bd-2)]">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-b border-[var(--bd-2)]">
              <Reveal delay={Math.min(i * 0.04, 0.2)} className="flex gap-6 py-8">
                <span className="font-display font-extrabold text-[13px] tracking-[0.12em] text-[var(--brand-text)] tabular-nums w-7 shrink-0 pt-1.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="title-lg text-[var(--fg-1)]">{s.title}</h2>
                  <p className="mt-2 text-[15px] leading-[1.7] text-[var(--fg-3)] max-w-[40ch]">{s.desc}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="alt">
        <SectionHead eyebrow="Costos" title="Qué pagás y a quién" />
        <div className="grid md:grid-cols-3 border-t border-[var(--bd-2)] md:divide-x divide-[var(--bd-1)]">
          {WHO.map((w) => (
            <div key={w.who} className="py-10 md:px-8 first:md:pl-0 last:md:pr-0 border-b md:border-b-0 border-[var(--bd-1)]">
              <p className="eyebrow before:hidden mb-5">{w.who}</p>
              <p className="font-display font-extrabold text-[1.375rem] leading-snug tracking-[-0.02em] text-[var(--fg-1)]">{w.what}</p>
              <p className="mt-3 text-[15px] leading-[1.7] text-[var(--fg-3)]">{w.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="Recepción" title="Tu dirección en Estados Unidos" />
        <div className="max-w-[640px]">
          <p className="prose-calm">
            Al registrarte te asignamos un código personal con este formato:{' '}
            <span className="font-mono font-medium text-[var(--fg-1)]">OPT-UY-######</span>. Usalo en el nombre o suite de la dirección de envío de la tienda.
          </p>
          <p className="mt-6 font-mono text-[13px] text-[var(--fg-4)]">[DIRECCIÓN DE RECEPCIÓN EN EE.UU. — pendiente de confirmar por Optimus]</p>
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
            <Button onClick={() => window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'register' } }))} size="lg">Crear mi cuenta</Button>
            <Button to="/tarifas" variant="outline" size="lg">Ver tarifas</Button>
            <Link to="/catalogo" className="link-arrow">Ver tiendas</Link>
          </div>
        </div>
      </Section>
    </div>
  )
}
