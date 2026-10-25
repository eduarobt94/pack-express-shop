import { motion } from 'framer-motion'
import { Eye, ShieldCheck, MessageCircle, RotateCcw } from 'lucide-react'

const ITEMS = [
  { Icon: Eye, accent: '#E31E24', title: 'Costos a la vista', desc: 'Producto, comisión y envío por separado. Cero vueltas.' },
  { Icon: ShieldCheck, accent: '#A8A8A8', title: 'Pagás el producto vos', desc: 'En la tienda, con tus medios de pago. Nunca te pedimos tarjetas.' },
  { Icon: MessageCircle, accent: '#E31E24', title: 'Atención en Uruguay', desc: 'Cobro y atención presencial en nuestra sucursal.' },
  { Icon: RotateCcw, accent: '#A8A8A8', title: 'Seguimiento claro', desc: 'Sabés dónde está tu paquete en cada etapa.' },
]

export default function BenefitsCompact() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ITEMS.map(({ Icon, accent, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.2) }}
            className="flex items-start gap-3 p-4 rounded-2xl card-surface"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1A`, border: `1px solid ${accent}33` }}>
              <Icon size={19} style={{ color: accent }} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-[13.5px] text-[var(--fg-1)] leading-tight">{title}</h3>
              <p className="text-[11.5px] text-[var(--fg-3)] mt-1 leading-snug">{desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
