import { motion } from 'framer-motion'

// Curva de entrada suave (ease-out) y duración lenta: las revelaciones son discretas, nunca estridentes.
export const EASE = [0.22, 1, 0.36, 1]

/** Revelación al hacer scroll: fundido + desplazamiento de 12 px. Respeta prefers-reduced-motion (MotionConfig). */
export function Reveal({ children, delay = 0, className = '', as = 'div' }) {
  const Comp = motion[as]
  return (
    <Comp
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      className={className}
    >
      {children}
    </Comp>
  )
}

/** Sección con ritmo vertical de la escala de 8 px. tone="alt" usa el papel cálido de la marca. */
export function Section({ children, tone, tight = false, className = '', id, ...rest }) {
  const cls = `${tight ? 'section-tight' : 'section'} ${tone === 'alt' ? 'section-alt' : ''} ${className}`
  return (
    <section id={id} className={cls} {...rest}>
      <div className="container-x">{children}</div>
    </section>
  )
}

/** Encabezado de página: eyebrow + título display (Space Grotesk 700) + bajada en Inter 400. */
export function PageHeader({ eyebrow, title, lead, children }) {
  return (
    <header className="container-x pt-16 pb-12 sm:pt-24 sm:pb-16">
      {eyebrow && <p className="eyebrow mb-6">{eyebrow}</p>}
      <h1 className="display max-w-[16ch] text-[var(--fg-1)]">{title}</h1>
      {lead && <p className="lead mt-6 max-w-[56ch]">{lead}</p>}
      {children}
    </header>
  )
}

/** Cabecera de sección: eyebrow + título + enlace opcional alineado a la derecha. */
export function SectionHead({ eyebrow, title, lead, action }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-12 sm:mb-16">
      <div className="max-w-[640px]">
        {eyebrow && <p className="eyebrow mb-5">{eyebrow}</p>}
        <h2 className="title-xl text-[var(--fg-1)]">{title}</h2>
        {lead && <p className="lead mt-4">{lead}</p>}
      </div>
      {action}
    </div>
  )
}
