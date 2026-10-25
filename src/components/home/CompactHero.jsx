import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Truck, ShieldCheck } from 'lucide-react'
import ProductVisual from '../ui/ProductVisual'
import { getProduct, discountPct } from '../../data/products'
import { formatUSD } from '../../lib/format'

const star = getProduct('ef-delta-2-max')

export default function CompactHero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* Main promo banner */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-2xl border border-[var(--bd-2)] min-h-[300px] sm:min-h-[340px] flex"
          style={{ background: 'radial-gradient(130% 120% at 85% 10%, rgba(227,30,36,0.18), transparent 55%), var(--bg-card)' }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-50" aria-hidden="true">
            <defs>
              <pattern id="hero-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="15" cy="15" r="0.9" fill="var(--fg-1)" opacity="0.05" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-dots)" />
          </svg>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 p-6 sm:p-9 w-full">
            <div className="flex-1 order-2 sm:order-1 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E31E24] text-white text-[11px] font-bold uppercase tracking-wider mb-3">
                <Zap size={12} /> Oferta destacada · -{discountPct(star)}%
              </span>
              <h1 className="font-display font-extrabold text-[clamp(1.5rem,3.5vw,2.4rem)] leading-[1.1] text-[var(--fg-1)] mb-2">
                Tu compra de EE.UU.,<br className="hidden sm:block" /> en Uruguay antes de lo esperado
              </h1>
              <p className="text-[14px] text-[var(--fg-3)] mb-4 max-w-md mx-auto sm:mx-0">
                {star.name} — respaldo de 2048 Wh ante cualquier apagón. Envío e impuestos incluidos.
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-5">
                <span className="font-display font-extrabold text-2xl text-[var(--fg-1)]">{formatUSD(star.price)}</span>
                <span className="text-[15px] text-[var(--fg-4)] line-through">{formatUSD(star.compareAt)}</span>
              </div>
              <Link
                to={`/producto/${star.id}`}
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E31E24] hover:bg-[#C81A1F] text-white font-semibold text-sm transition-all hover:shadow-[0_0_32px_rgba(227,30,36,0.32)]"
              >
                Comprar ahora
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="order-1 sm:order-2 w-40 h-40 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shrink-0">
              <ProductVisual icon={star.icon} tint={star.tint} size="lg" />
            </div>
          </div>
        </motion.div>

        {/* Side promos */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <SidePromo
            to="/catalogo?cat=movilidad-electrica"
            tint="#A8A8A8"
            icon="Bike"
            eyebrow="Movilidad"
            title="E-bikes y scooters"
            sub="Hasta 75 km de autonomía"
            delay={0.1}
          />
          <SidePromo
            to="/seguimiento"
            tint="#E31E24"
            icon="MapPin"
            eyebrow="¿Ya compraste?"
            title="Rastrea tu pedido"
            sub="Seguimiento en tiempo real"
            delay={0.18}
          />
        </div>
      </div>

      {/* Trust strip — compact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="grid grid-cols-3 gap-3 mt-4"
      >
        {[
          { Icon: Truck, label: 'Envío a los 19 departamentos' },
          { Icon: ShieldCheck, label: 'Impuestos transparentes' },
          { Icon: Zap, label: 'Entrega en 7–20 días' },
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
