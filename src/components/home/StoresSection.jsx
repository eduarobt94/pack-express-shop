import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Clock, X, ShoppingBag } from 'lucide-react'
import { MARKETPLACES } from '../../lib/marketplaces/types'
import { searchAmazon } from '../../lib/marketplaces/amazonAdapter'
import { useTheme } from '../../context/ThemeContext'
import ProductCard from '../ui/ProductCard'

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
  const [amazonProducts, setAmazonProducts] = useState([])
  const [amazonLoading, setAmazonLoading] = useState(true)

  useEffect(() => {
    let active = true
    searchAmazon().then((list) => {
      if (active) {
        setAmazonProducts(list.slice(0, 6))
        setAmazonLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  function handleClick(store) {
    if (MARKETPLACES[store.id].status === 'available') {
      navigate(`/catalogo?marketplace=${store.id}`)
    } else {
      setModalStore(store)
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
      {/* Título sección */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--sec)]">Marketplaces disponibles</span>
          <h2 className="font-display font-extrabold text-[clamp(1.4rem,3.2vw,1.9rem)] text-[var(--fg-1)] mt-1">
            Compra en tus tiendas favoritas
          </h2>
        </div>
      </div>

      {/* Cards de tiendas */}
      <div className="grid sm:grid-cols-3 gap-4">
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
              className="group relative text-left card-surface rounded-2xl p-5 overflow-hidden hover:border-[var(--bd-3)] hover:shadow-[var(--shadow-hover)] transition-all duration-300 cursor-pointer"
            >
              {/* Glow de marca */}
              <div
                className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-[0.12] group-hover:opacity-20 transition-opacity"
                style={{ background: meta.color }}
              />

              <div className="relative flex items-center justify-between mb-4">
                {/* Logo de la tienda */}
                <div className="h-10 flex items-center">
                  <StoreLogo id={store.id} />
                </div>
                {available ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#22C55E]/[0.12] text-[#22C55E]">
                    Disponible
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E31E24]/[0.12] text-[#E31E24]">
                    <Clock size={11} /> Próximamente
                  </span>
                )}
              </div>

              <h3 className="relative font-display font-bold text-[18px] text-[var(--fg-1)] mb-1">{meta.name}</h3>
              <p className="relative text-[13px] text-[var(--fg-3)] mb-4">{store.tagline}</p>

              <span className="relative inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: meta.color }}>
                {available ? 'Explorar catálogo' : 'Más información'}
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* ── Productos de Amazon ──────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E31E24]">Amazon · Disponible ahora</span>
            <h3 className="font-display font-bold text-[18px] sm:text-[20px] text-[var(--fg-1)]">
              Productos destacados de Amazon
            </h3>
          </div>
          <button
            onClick={() => navigate('/catalogo?marketplace=amazon')}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#E31E24] hover:underline cursor-pointer shrink-0"
          >
            Ver todo <ArrowRight size={14} />
          </button>
        </div>

        {amazonLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--bd-1)] overflow-hidden">
                <div className="aspect-[4/3] bg-[var(--bd-2)] animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-2.5 bg-[var(--bd-2)] rounded-full w-1/2 animate-pulse" />
                  <div className="h-3.5 bg-[var(--bd-2)] rounded-full w-3/4 animate-pulse" />
                  <div className="h-2.5 bg-[var(--bd-2)] rounded-full w-full animate-pulse" />
                  <div className="h-4 bg-[var(--bd-2)] rounded-full w-2/5 mt-2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {amazonProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
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
                className="pointer-events-auto w-full max-w-sm bg-[var(--bg-base)] border border-[var(--bd-2)] rounded-3xl p-7 text-center shadow-2xl relative"
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

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#E31E24]/[0.12] text-[#E31E24] mb-3">
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
                  className="w-full py-3 rounded-xl bg-[#E31E24] hover:bg-[#C81A1F] text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Entendido
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}
