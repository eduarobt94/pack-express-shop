import { Link } from 'react-router-dom'
import { Reveal, Section, SectionHead } from '../ui/Layout'

const STEPS = [
  { title: 'Registrate', text: 'Recibís tu código personal y la dirección de recepción en EE.UU.' },
  { title: 'Comprá y registrá', text: 'Pagás en la tienda y cargás el comprobante y el destinatario.' },
  { title: 'Pagás en la sucursal', text: 'Con el peso real, emitimos la liquidación. El cobro es presencial.' },
  { title: 'Recibe en Cuba', text: 'Despachamos con el pago completo. Seguís el envío desde tu cuenta.' },
]

/** Cuatro pasos visibles; el detalle de los ocho vive en /como-comprar. */
export default function HowItWorks() {
  return (
    <Section>
      <SectionHead
        eyebrow="Cómo funciona"
        title="Cuatro pasos"
        action={<Link to="/como-comprar" className="link-arrow shrink-0">Ver los 8 pasos</Link>}
      />
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-[var(--bd-2)] lg:divide-x divide-[var(--bd-1)]">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-b lg:border-b-0 border-[var(--bd-1)] lg:px-8 lg:first:pl-0 lg:last:pr-0">
            <Reveal delay={i * 0.06} className="py-10">
              <span className="font-display font-extrabold text-[13px] tracking-[0.12em] text-[var(--brand-text)] tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 title-lg text-[var(--fg-1)]">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-[var(--fg-3)] max-w-[30ch]">{s.text}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  )
}
