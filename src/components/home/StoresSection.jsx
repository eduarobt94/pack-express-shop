import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Clock, X, ShoppingBag } from 'lucide-react'
import { MARKETPLACES } from '../../lib/marketplaces/types'
import { useTheme } from '../../context/ThemeContext'
import { Section, SectionHead } from '../ui/Layout'


// ── Logos de cada marketplace ────────────────────────────────────────────────
function StoreLogo({ id }) {
  const { theme } = useTheme()

  if (id === 'amazon') {
    return (
      <img
        src={theme === 'dark' ? '/logos/amazon-dark.svg' : '/logos/amazon-light.svg'}
        alt="Amazon"
        className="h-7 w-auto select-none"
        draggable={false}
      />
    )
  }
  if (id === 'temu') {
    return (
      <img
        src="/logos/temu.svg"
        alt="Temu"
        className="h-9 w-9 rounded-xl select-none"
        draggable={false}
      />
    )
  }
  if (id === 'walmart') {
    return (
      <div className="flex items-center gap-1.5">
        {/* Walmart spark: 6 pétalos elípticos */}
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none">
          <ellipse cx="10" cy="3.8" rx="2" ry="3.2" fill="#FFC220" />
          <ellipse cx="10" cy="3.8" rx="2" ry="3.2" fill="#FFC220" transform="rotate(60 10 10)" />
          <ellipse cx="10" cy="3.8" rx="2" ry="3.2" fill="#FFC220" transform="rotate(120 10 10)" />
          <ellipse cx="10" cy="3.8" rx="2" ry="3.2" fill="#FFC220" transform="rotate(180 10 10)" />
          <ellipse cx="10" cy="3.8" rx="2" ry="3.2" fill="#FFC220" transform="rotate(240 10 10)" />
          <ellipse cx="10" cy="3.8" rx="2" ry="3.2" fill="#FFC220" transform="rotate(300 10 10)" />
        </svg>
        <span
          className="text-[14px] leading-none tracking-tight select-none"
          style={{ color: '#007DC6', fontFamily: '"Arial Black", Helvetica, sans-serif', fontWeight: 900 }}
        >
          walmart
        </span>
      </div>
    )
  }
  return null
}

const STORES = [
  { id: 'amazon',  tagline: 'Miles de productos disponibles',     desc: 'Elegí en Amazon con tu dirección de recepción de Optimus. El pago del producto es en la tienda.' },
  { id: 'temu',   tagline: 'Próximamente',                         desc: 'Tienda pendiente de aprobación por Optimus.' },
  { id: 'walmart', tagline: 'Próximamente',                        desc: 'Tienda pendiente de aprobación por Optimus.' },
]

export default function StoresSection() {
  const navigate = useNavigate()
  const [modalStore, setModalStore] = useState(null)
  function handleClick(store) {
    if (MARKETPLACES[store.id].status === 'available') {
      navigate(`/catalogo?marketplace=${store.id}`)
    } else {
      setModalStore(store)
    }
  }

  return (
    <Section tone="alt">
      <SectionHead eyebrow="Dónde comprar" title="Tiendas autorizadas" lead="Elegís en la tienda; nosotros nos ocupamos del resto." />

      {/* Cards de tiendas */}
      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
        {STORES.map((store, i) => {
          const meta = MARKETPLACES[store.id]
          const available = meta.status === 'available'
          return (
            <motion.button
              key={store.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.08, 0.24), ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleClick(store)}
              className="group relative text-left card-surface rounded-xl p-8 overflow-hidden hover:border-[var(--bd-3)] hover:shadow-[var(--shadow-hover)] cursor-pointer"
            >
              <div className="relative flex items-center justify-between mb-10">
                {/* Logo de la tienda */}
                <div className="h-10 flex items-center">
                  <StoreLogo id={store.id} />
                </div>
                {available ? (
                  <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--ok-text)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" aria-hidden="true" /> Disponible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--fg-4)]">
                    <Clock size={12} strokeWidth={1.5} /> Próximamente
                  </span>
                )}
              </div>

              <h3 className="relative title-lg text-[var(--fg-1)] mb-2">{meta.name}</h3>
              <p className="relative text-[15px] text-[var(--fg-3)] mb-8">{store.tagline}</p>

              <span className="relative link-arrow">
                {available ? 'Explorar catálogo' : 'Más información'}
                <ArrowRight size={15} strokeWidth={2} className="group-hover:translate-x-1 transition-transform duration-500" />
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Modal "Próximamente" */}
      <AnimatePresence>
        {modalStore && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm"
              onClick={() => setModalStore(null)}
            />
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-5 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto w-full max-w-sm bg-[var(--bg-base)] border border-[var(--bd-2)] rounded-xl p-10 text-center shadow-2xl relative"
              >
                <button
                  onClick={() => setModalStore(null)}
                  aria-label="Cerrar"
                  className="absolute top-4 right-4 w-9 h-9 rounded-xl border border-[var(--bd-2)] flex items-center justify-center text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors cursor-pointer"
                >
                  <X size={17} />
                </button>

                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ background: `${MARKETPLACES[modalStore.id].color}18`, color: MARKETPLACES[modalStore.id].color }}>
                  <ShoppingBag size={30} />
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#E31E24]/[0.12] text-[var(--brand-text)] mb-3">
                  <Clock size={12} /> Próximamente
                </span>

                <h3 className="font-display font-extrabold text-[20px] text-[var(--fg-1)] mb-2">
                  {MARKETPLACES[modalStore.id].name}
                </h3>
                <p className="text-[14px] text-[var(--fg-3)] leading-relaxed mb-6">
                  Estamos trabajando en la integración con {MARKETPLACES[modalStore.id].name}. Todavía no está habilitada.
                </p>

                <button
                  onClick={() => setModalStore(null)}
                  className="w-full h-12 rounded-lg bg-[#E31E24] hover:bg-[#C81A1F] text-white font-sans font-semibold text-[15px] transition-colors duration-300 cursor-pointer"
                >
                  Entendido
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </Section>
  )
}
