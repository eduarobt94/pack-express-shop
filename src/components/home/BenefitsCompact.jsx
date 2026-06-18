import { motion } from 'framer-motion'
import { Eye, ShieldCheck, MessageCircle, RotateCcw } from 'lucide-react'

const ITEMS = [
  { Icon: Eye, accent: '#F07232', title: 'Precio transparente', desc: 'Producto, flete y aduana visibles desde el inicio.' },
  { Icon: ShieldCheck, accent: '#527ED8', title: 'Productos originales', desc: 'Comprados en tiendas oficiales de EE.UU.' },
  { Icon: MessageCircle, accent: '#F07232', title: 'Seguimiento WhatsApp', desc: 'Notificaciones en cada etapa del envío.' },
  { Icon: RotateCcw, accent: '#527ED8', title: 'Garantía de entrega', desc: 'Entregamos o te devolvemos tu dinero.' },
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
