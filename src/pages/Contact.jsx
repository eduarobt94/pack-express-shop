import { PageHeader, Section, SectionHead } from '../components/ui/Layout'

const FAQ = [
  { q: '¿Pago el producto a Optimus?', a: 'No. El producto se paga en la tienda con tus medios de pago. A Optimus le pagás en la sucursal la comisión y el envío.' },
  { q: '¿La aduana está incluida?', a: 'No. La paga el destinatario en Cuba al recibir el paquete.' },
  { q: '¿Tengo que registrar mi compra?', a: 'Sí. La tienda no nos informa qué compraste, así que el registro con comprobante es obligatorio.' },
  { q: '¿Cuándo despachan?', a: 'Cuando el cliente, el destinatario y los paquetes están identificados, el producto está aprobado y la liquidación final está pagada.' },
  { q: '¿Qué productos se admiten?', a: 'Optimus aprueba los artículos antes de publicarlos. Baterías, paneles, generadores y equipos voluminosos se confirman caso por caso.' },
]

const PENDING = ['Cancelaciones', 'Almacenamiento', 'Paquetes no identificados', 'Falta de pago', 'Pérdida, daño y seguro', 'Reclamos y devoluciones', 'Privacidad y datos personales']

const CONTACT = [
  { label: 'Sucursal en Uruguay', text: '[DIRECCIÓN DE LA SUCURSAL]' },
  { label: 'Horarios', text: '[HORARIOS DE ATENCIÓN]' },
  { label: 'WhatsApp', text: '[WHATSAPP]' },
  { label: 'Correo', text: '[EMAIL]' },
]

export default function Contact() {
  return (
    <div>
      <PageHeader eyebrow="Contacto" title="Contacto y condiciones" lead="Atención y cobro presencial en nuestra sucursal de Uruguay." />

      <Section tight>
        <dl className="grid sm:grid-cols-2 border-t border-[var(--bd-2)] sm:gap-x-16">
          {CONTACT.map((c) => (
            <div key={c.label} className="py-8 border-b border-[var(--bd-2)]">
              <dt className="eyebrow before:hidden mb-4">{c.label}</dt>
              <dd className="font-mono text-[15px] text-[var(--fg-2)]">{c.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="alt">
        <SectionHead eyebrow="Ayuda" title="Preguntas frecuentes" />
        <div className="max-w-[760px] border-t border-[var(--bd-2)]">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-[var(--bd-2)]">
              <summary className="py-7 cursor-pointer list-none flex items-center justify-between gap-6 font-display font-extrabold text-[1.125rem] tracking-[-0.01em] text-[var(--fg-1)]">
                {f.q}
                <span className="text-[var(--brand-text)] text-2xl font-light leading-none group-open:rotate-45 transition-transform duration-500" aria-hidden="true">+</span>
              </summary>
              <p className="pb-8 -mt-1 text-[15px] leading-[1.75] text-[var(--fg-3)] max-w-[60ch]">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="Legal" title="Condiciones del servicio" />
        <div className="max-w-[760px]">
          <p className="prose-calm">
            Las condiciones comerciales todavía no están aprobadas por Optimus y no se publican como definitivas. Quedan por definir:
          </p>
          <ul className="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-3 text-[15px] text-[var(--fg-3)]">
            {PENDING.map((p) => (
              <li key={p} className="flex gap-4">
                <span className="mt-[0.7em] w-1 h-1 rounded-full bg-[var(--color-brand)] shrink-0" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  )
}
