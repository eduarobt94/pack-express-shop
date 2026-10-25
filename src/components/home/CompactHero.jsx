import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Truck, ShieldCheck, Store, Wallet } from 'lucide-react'
import Button from '../ui/Button'

export default function CompactHero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-xl border border-[var(--bd-2)] min-h-[300px] sm:min-h-[340px] flex"
          style={{ background: 'radial-gradient(130% 120% at 85% 10%, rgba(227,30,36,0.12), transparent 55%), var(--bg-card)' }}
        >
          <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 w-full">
            <span className="inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E31E24] text-white text-[11px] font-display font-extrabold uppercase tracking-[0.04em] mb-4">
              <Truck size={12} /> Uruguay → Cuba
            </span>
            <h1 className="font-display font-black text-[clamp(1.75rem,4vw,3.25rem)] leading-[1.05] text-[var(--fg-1)] mb-3">
              Comprás en EE.UU.<br />Tu familia recibe en Cuba.
            </h1>
            <p className="font-display italic font-light text-[clamp(1rem,1.6vw,1.2rem)] text-[var(--fg-3)] mb-6 max-w-xl">
              Los más rápidos de Montevideo. Pagás el producto en la tienda y a nosotros, en la sucursal, solo la gestión y el envío.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => window.dispatchEvent(new Event('open-login'))} size="lg">
                Registrarme <ArrowRight size={16} />
              </Button>
              <Button to="/catalogo" variant="outline" size="lg">Ver tiendas</Button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <SidePromo to="/como-comprar" tint="#E31E24" icon="ListChecks" eyebrow="Paso a paso" title="Cómo comprar" sub="Qué pagás, y a quién" delay={0.1} />
          <SidePromo to="/seguimiento" tint="#A8A8A8" icon="MapPin" eyebrow="¿Ya compraste?" title="Consultá tu compra" sub="Seguimiento en cada etapa" delay={0.18} />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-3 gap-3 mt-4"
      >
        {[
          { Icon: Store, label: 'Comprás en la tienda que elijas' },
          { Icon: Wallet, label: 'Pagás gestión y envío en sucursal' },
          { Icon: ShieldCheck, label: 'Aduana en Cuba la paga quien recibe' },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center justify-center sm:justify-start gap-2.5 px-4 py-3 rounded-xl card-surface">
            <Icon size={18} className="text-[var(--sec)] shrink-0" />
            <span className="text-[12.5px] font-medium text-[var(--fg-2)] hidden sm:block">{label}</span>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

import * as Icons from 'lucide-react'
function SidePromo({ to, tint, icon, eyebrow, title, sub, delay }) {
  const Icon = Icons[icon] || Icons.Package
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}>
      <Link
        to={to}
        className="group relative block h-full overflow-hidden rounded-2xl border border-[var(--bd-2)] p-5 hover:border-[var(--bd-3)] hover:shadow-[var(--shadow-hover)] transition-all duration-300 min-h-[140px] lg:min-h-[160px]"
        style={{ background: `radial-gradient(120% 120% at 100% 0%, ${tint}1F, transparent 55%), var(--bg-card)` }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-auto" style={{ background: `${tint}1A`, border: `1px solid ${tint}33` }}>
          <Icon size={20} style={{ color: tint }} />
        </div>
        <div className="mt-5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: tint }}>{eyebrow}</span>
          <h3 className="font-display font-bold text-[15px] text-[var(--fg-1)] mt-0.5">{title}</h3>
          <p className="text-[12px] text-[var(--fg-3)] mt-0.5">{sub}</p>
        </div>
        <ArrowRight size={16} className="absolute top-5 right-5 text-[var(--fg-4)] group-hover:text-[var(--fg-1)] transition-all group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  )
}
