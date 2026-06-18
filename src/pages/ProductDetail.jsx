import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Check, ShieldCheck, Truck, RotateCcw, Star, ExternalLink, Search } from 'lucide-react'
import { getProduct, products } from '../data/products'
import { getCategory } from '../data/categories'
import { getAmazonProduct } from '../lib/marketplaces/amazonAdapter'
import ProductVisual from '../components/ui/ProductVisual'
import ProductCard from '../components/ui/ProductCard'
import ShippingCalculator from '../components/ui/ShippingCalculator'
import Stars from '../components/ui/Stars'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import MarketplaceBadge from '../components/ui/MarketplaceBadge'
import { formatUSD } from '../lib/format'

export default function ProductDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const marketplace = params.get('marketplace')

  // Producto local (síncrono) o de marketplace (async)
  const localProduct = marketplace ? null : getProduct(id)
  const [mktProduct, setMktProduct] = useState(null)
  const [loading, setLoading] = useState(Boolean(marketplace))

  useEffect(() => {
    let active = true
    if (marketplace === 'amazon') {
      setLoading(true)
      getAmazonProduct(id).then((p) => {
        if (active) { setMktProduct(p); setLoading(false) }
      })
    }
    return () => { active = false }
  }, [marketplace, id])

  if (loading) {
    return (
      <div className="pt-0 min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--bd-3)] border-t-[#F07232] animate-spin" />
      </div>
    )
  }

  const product = localProduct || mktProduct
  if (!product) {
    return (
      <div className="pt-0 min-h-screen flex items-center">
        <EmptyState
          icon="PackageX"
          title="Producto no encontrado"
          description="El producto que buscas no existe o fue retirado del catálogo."
          action={<Button to="/catalogo">Volver al catálogo</Button>}
        />
      </div>
    )
  }

  return localProduct
    ? <LocalDetail product={localProduct} />
    : <MarketplaceDetail product={mktProduct} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de producto de marketplace (Amazon) — datos de la API
// ─────────────────────────────────────────────────────────────────────────────

function MarketplaceDetail({ product }) {
  const soldOut = product.available === false
  return (
    <div className="pt-0">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5">
        <nav className="flex items-center gap-1.5 text-[12.5px] text-[var(--fg-4)] flex-wrap">
          <Link to="/" className="hover:text-[var(--fg-2)]">Inicio</Link>
          <ChevronRight size={13} />
          <Link to={`/catalogo?marketplace=${product.marketplace}`} className="hover:text-[var(--fg-2)]">Amazon</Link>
          <ChevronRight size={13} />
          <span className="text-[var(--fg-2)] font-medium truncate">{product.title}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-16 grid lg:grid-cols-2 gap-10">
        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="card-surface rounded-2xl overflow-hidden aspect-square relative"
        >
          <ProductVisual icon={product.icon} tint={product.tint} size="lg" />
          <div className="absolute top-4 left-4"><MarketplaceBadge marketplace={product.marketplace} size="md" /></div>
        </motion.div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#F07232]">{product.brand}</span>
            {typeof product.rating === 'number' && (
              <>
                <span className="text-[var(--fg-5)]">·</span>
                <div className="flex items-center gap-1.5">
                  <Stars rating={product.rating} size={14} />
                  <span className="text-[12px] text-[var(--fg-3)]">({product.reviews?.toLocaleString('es')} reseñas)</span>
                </div>
              </>
            )}
          </div>

          <h1 className="font-display font-extrabold text-[clamp(1.5rem,3.5vw,2.25rem)] text-[var(--fg-1)] leading-tight mb-2">
            {product.title}
          </h1>

          <div className="flex items-baseline gap-3 mb-5 mt-4">
            <span className="font-display font-extrabold text-3xl text-[var(--fg-1)]">{formatUSD(product.price)}</span>
            <span className="text-[13px] text-[var(--fg-4)]">{product.currency}</span>
          </div>

          {/* Disponibilidad */}
          <div className="flex items-center gap-2 mb-6">
            {soldOut ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#EF4444]">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> No disponible actualmente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#22C55E]">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> Disponible en Amazon
              </span>
            )}
          </div>

          <p className="text-[14px] text-[var(--fg-2)] leading-relaxed mb-6">{product.description}</p>

          {/* Identificador */}
          <div className="flex items-center gap-2 mb-7 text-[12.5px] text-[var(--fg-4)]">
            <span className="font-semibold text-[var(--fg-3)]">ASIN:</span>
            <span className="font-mono">{product.asin}</span>
          </div>

          {/* CTA externo */}
          <Button href={product.url} target="_blank" rel="noopener noreferrer" size="lg" className="w-full mb-7" disabled={soldOut}>
            <ExternalLink size={18} /> Ver en Amazon
          </Button>

          {/* Trust row */}
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              { Icon: ShieldCheck, label: 'Producto original' },
              { Icon: Truck, label: 'Envío asegurado a Cuba' },
              { Icon: RotateCcw, label: 'Seguimiento en cada etapa' },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl border border-[var(--bd-1)]">
                <Icon size={20} className="text-[#527ED8]" />
                <span className="text-[11.5px] font-medium text-[var(--fg-3)]">{label}</span>
              </div>
            ))}
          </div>

          {/* Calculadora de envío (estimación por valor del producto) */}
          <ShippingCalculator value={product.price} weightKg={2} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de producto local (catálogo hardcodeado) — sin carrito
// ─────────────────────────────────────────────────────────────────────────────

function LocalDetail({ product }) {
  const [activeImg, setActiveImg] = useState(0)
  const category = getCategory(product.category)
  const soldOut = product.stock === 0
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3)
  const amazonSearch = `/catalogo?marketplace=amazon&q=${encodeURIComponent(product.name)}`

  return (
    <div className="pt-0">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5">
        <nav className="flex items-center gap-1.5 text-[12.5px] text-[var(--fg-4)] flex-wrap">
          <Link to="/" className="hover:text-[var(--fg-2)]">Inicio</Link>
          <ChevronRight size={13} />
          <Link to="/catalogo" className="hover:text-[var(--fg-2)]">Catálogo</Link>
          <ChevronRight size={13} />
          <Link to={`/catalogo?cat=${product.category}`} className="hover:text-[var(--fg-2)]">{category?.name}</Link>
          <ChevronRight size={13} />
          <span className="text-[var(--fg-2)] font-medium truncate">{product.name}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-16 grid lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="card-surface rounded-2xl overflow-hidden aspect-square mb-3 relative"
          >
            <ProductVisual icon={product.icon} tint={product.gallery[activeImg]} size="lg" />
            {product.badge && <div className="absolute top-4 left-4"><Badge>{product.badge}</Badge></div>}
          </motion.div>
          <div className="grid grid-cols-3 gap-3">
            {product.gallery.map((g, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`card-surface rounded-xl overflow-hidden aspect-square transition-all cursor-pointer ${
                  activeImg === i ? 'ring-2 ring-[#F07232] ring-offset-2 ring-offset-[var(--bg-base)]' : 'opacity-60 hover:opacity-100'
                }`}
                aria-label={`Ver imagen ${i + 1}`}
              >
                <ProductVisual icon={product.icon} tint={g} size="sm" />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#F07232]">{product.brand}</span>
            <span className="text-[var(--fg-5)]">·</span>
            <div className="flex items-center gap-1.5">
              <Stars rating={product.rating} size={14} />
              <span className="text-[12px] text-[var(--fg-3)]">({product.reviews} reseñas)</span>
            </div>
          </div>

          <h1 className="font-display font-extrabold text-[clamp(1.5rem,3.5vw,2.25rem)] text-[var(--fg-1)] leading-tight mb-2">
            {product.name}
          </h1>
          <p className="text-[15px] text-[var(--fg-2)] mb-5">{product.tagline}</p>

          <div className="flex items-baseline gap-3 mb-5">
            <span className="font-display font-extrabold text-3xl text-[var(--fg-1)]">{formatUSD(product.price)}</span>
            {product.compareAt && (
              <>
                <span className="text-lg text-[var(--fg-4)] line-through">{formatUSD(product.compareAt)}</span>
                <span className="px-2 py-1 rounded-lg text-[12px] font-bold text-white bg-[#F07232]">
                  Ahorra {formatUSD(product.compareAt - product.price)}
                </span>
              </>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2 mb-6">
            {soldOut ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#EF4444]">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Agotado temporalmente
              </span>
            ) : product.stock <= 5 ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#F5A524]">
                <span className="w-2 h-2 rounded-full bg-[#F5A524] animate-pulse" /> ¡Solo quedan {product.stock} unidades!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#22C55E]">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" /> En stock · listo para enviar
              </span>
            )}
          </div>

          <p className="text-[14px] text-[var(--fg-2)] leading-relaxed mb-6">{product.short}</p>

          {/* Highlights */}
          <ul className="grid sm:grid-cols-2 gap-2.5 mb-7">
            {product.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-[13.5px] text-[var(--fg-2)]">
                <Check size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                {h}
              </li>
            ))}
          </ul>

          {/* CTA — buscar en Amazon (sin carrito) */}
          <Button to={amazonSearch} variant="blue" size="lg" className="w-full mb-7">
            <Search size={18} /> Buscar este producto en Amazon
          </Button>

          {/* Trust row */}
          <div className="grid grid-cols-3 gap-3 mb-7">
            {[
              { Icon: ShieldCheck, label: 'Garantía oficial' },
              { Icon: Truck, label: 'Envío asegurado' },
              { Icon: RotateCcw, label: 'Devolución 30 días' },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2 p-3 rounded-xl border border-[var(--bd-1)]">
                <Icon size={20} className="text-[#527ED8]" />
                <span className="text-[11.5px] font-medium text-[var(--fg-3)]">{label}</span>
              </div>
            ))}
          </div>

          {/* Shipping calculator */}
          <ShippingCalculator value={product.price} weightKg={product.weightKg} />
        </div>
      </div>

      {/* Specs */}
      <div className="border-t border-[var(--bd-1)] bg-[var(--bg-alt)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="font-display font-bold text-xl text-[var(--fg-1)] mb-5">Especificaciones técnicas</h2>
            <dl className="card-surface rounded-2xl overflow-hidden">
              {Object.entries(product.specs).map(([k, v], i) => (
                <div key={k} className={`flex items-center justify-between px-5 py-3.5 ${i % 2 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-elevated)]'}`}>
                  <dt className="text-[13.5px] text-[var(--fg-3)]">{k}</dt>
                  <dd className="text-[13.5px] font-semibold text-[var(--fg-1)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-[var(--fg-1)] mb-5">Reseñas de clientes</h2>
            <div className="card-surface rounded-2xl p-6 flex items-center gap-6">
              <div className="text-center shrink-0">
                <div className="font-display font-extrabold text-4xl text-[var(--fg-1)]">{product.rating.toFixed(1)}</div>
                <Stars rating={product.rating} size={14} />
                <div className="text-[12px] text-[var(--fg-4)] mt-1">{product.reviews} reseñas</div>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const pct = star === 5 ? 78 : star === 4 ? 16 : star === 3 ? 4 : star === 2 ? 1 : 1
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-[11px] text-[var(--fg-4)] w-7">{star}<Star size={9} className="fill-current" /></span>
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--bd-1)] overflow-hidden">
                        <div className="h-full rounded-full bg-[#F5A524]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-[var(--fg-4)] w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14">
          <h2 className="font-display font-bold text-xl text-[var(--fg-1)] mb-6">También te puede interesar</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}
