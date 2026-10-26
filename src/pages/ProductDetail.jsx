import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ExternalLink, Search } from 'lucide-react'
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
import { Section, SectionHead } from '../components/ui/Layout'
import { formatUSD, formatDate } from '../lib/format'
import { safeUrl } from '../lib/safeUrl'
import { PriceNotice, ReceptionReminder } from '../components/ui/Notices'

const TRUST = ['Pagás el producto en la tienda', 'Entrega en Cuba', 'Seguimiento en cada etapa']

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
        <div className="w-8 h-8 rounded-full border border-[var(--bd-3)] border-t-[var(--color-brand)] animate-spin" />
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

function Crumbs({ items }) {
  return (
    <nav aria-label="Ruta" className="container-x pt-10 md:pt-14">
      <ol className="flex items-center gap-x-3 gap-y-1 text-[12px] tracking-[0.04em] text-[var(--fg-4)] flex-wrap">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-3 min-w-0">
            {i > 0 && <span aria-hidden="true">/</span>}
            {it.to ? (
              <Link to={it.to} className="hover:text-[var(--fg-1)] transition-colors duration-300">{it.label}</Link>
            ) : (
              <span className="text-[var(--fg-2)] truncate" aria-current="page">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Trust() {
  return (
    <ul className="grid sm:grid-cols-3 border-y border-[var(--bd-2)] sm:divide-x divide-[var(--bd-1)] mb-10">
      {TRUST.map((label) => (
        <li key={label} className="py-5 sm:px-5 first:sm:pl-0 last:sm:pr-0 text-[13px] leading-snug text-[var(--fg-3)]">{label}</li>
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalle de producto de marketplace (Amazon) — datos de la API
// ─────────────────────────────────────────────────────────────────────────────

function MarketplaceDetail({ product }) {
  const soldOut = product.available === false
  return (
    <div className="pt-0">
      <Crumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Amazon', to: `/catalogo?marketplace=${product.marketplace}` }, { label: product.title }]} />

      <div className="container-x pt-10 pb-24 md:pb-32 grid lg:grid-cols-12 gap-12 lg:gap-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="lg:col-span-6 rounded-xl overflow-hidden aspect-square relative border border-[var(--bd-1)] self-start"
        >
          <ProductVisual icon={product.icon} tint={product.tint} size="lg" />
          <div className="absolute top-5 left-5"><MarketplaceBadge marketplace={product.marketplace} size="md" /></div>
        </motion.div>

        <div className="lg:col-span-6">
          <div className="flex items-center gap-4 mb-5">
            <p className="eyebrow before:hidden">{product.brand}</p>
            {typeof product.rating === 'number' && (
              <div className="flex items-center gap-2">
                <Stars rating={product.rating} size={13} />
                <span className="text-[12px] text-[var(--fg-3)]">({product.reviews?.toLocaleString('es')} reseñas)</span>
              </div>
            )}
          </div>

          <h1 className="title-xl text-[var(--fg-1)]">{product.title}</h1>

          <p className="mt-8 flex items-baseline gap-3">
            <span className="font-display font-extrabold text-[2rem] tracking-[-0.02em] tabular-nums text-[var(--fg-1)]">{formatUSD(product.price)}</span>
            <span className="text-[13px] text-[var(--fg-4)]">{product.currency}</span>
          </p>

          <p className={`mt-4 text-[13px] font-medium ${soldOut ? 'text-[var(--err-text)]' : 'text-[var(--ok-text)]'}`}>
            {soldOut ? 'No disponible actualmente' : 'Disponible en Amazon'}
          </p>

          <p className="prose-calm mt-8">{product.description}</p>

          <p className="mt-6 text-[12.5px] text-[var(--fg-4)]">
            <span className="font-medium text-[var(--fg-3)]">ASIN:</span> <span className="font-mono">{product.asin}</span>
          </p>

          <div className="mt-10">
            <ReceptionReminder />
            <Button href={safeUrl(product.url)} target="_blank" rel="noopener noreferrer" size="lg" className="w-full mb-10" disabled={soldOut || !safeUrl(product.url)}>
              <ExternalLink size={18} strokeWidth={1.5} /> Comprar en Amazon
            </Button>
          </div>

          <Trust />

          <ShippingCalculator value={product.price} />
          <PriceNotice />
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
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3)
  const amazonSearch = `/catalogo?marketplace=amazon&q=${encodeURIComponent(product.name)}`

  return (
    <div className="pt-0">
      <Crumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: 'Catálogo', to: '/catalogo' },
          { label: category?.name ?? 'Categoría', to: `/catalogo?cat=${product.category}` },
          { label: product.name },
        ]}
      />

      <div className="container-x pt-10 pb-24 md:pb-32 grid lg:grid-cols-12 gap-12 lg:gap-20">
        <div className="lg:col-span-6 self-start">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="rounded-xl overflow-hidden aspect-square mb-4 relative border border-[var(--bd-1)]"
          >
            <ProductVisual icon={product.icon} tint={product.gallery[activeImg]} size="lg" />
            {product.badge && <div className="absolute top-5 left-5"><Badge>{product.badge}</Badge></div>}
          </motion.div>
          <div className="grid grid-cols-3 gap-4">
            {product.gallery.map((g, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`rounded-lg overflow-hidden aspect-square border transition-[border-color,opacity] duration-300 cursor-pointer ${
                  activeImg === i ? 'border-[var(--fg-1)]' : 'border-[var(--bd-1)] opacity-60 hover:opacity-100'
                }`}
                aria-label={`Ver imagen ${i + 1}`}
                aria-pressed={activeImg === i}
              >
                <ProductVisual icon={product.icon} tint={g} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6">
          <p className="eyebrow before:hidden mb-5">{product.brand}</p>
          <h1 className="title-xl text-[var(--fg-1)]">{product.name}</h1>
          <p className="lead mt-5">{product.tagline}</p>

          <p className="mt-8 flex items-baseline gap-3">
            <span className="font-display font-extrabold text-[2rem] tracking-[-0.02em] tabular-nums text-[var(--fg-1)]">{formatUSD(product.price)}</span>
            <span className="text-[13px] text-[var(--fg-4)]">USD · precio referencial</span>
          </p>

          <p className="mt-4 text-[13px] text-[var(--fg-3)]">
            {typeof product.available === 'boolean' && (
              <span className={product.available ? 'text-[var(--ok-text)] font-medium' : 'text-[var(--err-text)] font-medium'}>
                {product.available ? 'Disponible' : 'No disponible'}
              </span>
            )}
            {typeof product.available === 'boolean' && product.updatedAt && ' · '}
            {product.updatedAt && <>Precio actualizado el {formatDate(product.updatedAt)}</>}
          </p>

          <PriceNotice className="mt-6 mb-8" />

          <p className="prose-calm">{product.short}</p>

          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-8 mb-10">
            {product.highlights.map((h) => (
              <li key={h} className="flex items-start gap-3 text-[14px] leading-snug text-[var(--fg-2)]">
                <Check size={15} strokeWidth={1.5} className="text-[var(--ok-text)] shrink-0 mt-[3px]" />
                {h}
              </li>
            ))}
          </ul>

          <ReceptionReminder />
          <Button to={amazonSearch} variant="blue" size="lg" className="w-full mb-10">
            <Search size={18} strokeWidth={1.5} /> Buscar en Amazon
          </Button>

          <Trust />

          <p className="mb-5 text-[13px] leading-[1.7] text-[var(--fg-3)]">
            <span className="font-medium text-[var(--fg-1)]">Peso del equipo:</span> {product.weightKg} kg. El peso embalado todavía no está verificado: ingresá tu estimación o pedí cotización.
          </p>
          <ShippingCalculator value={product.price} />
        </div>
      </div>

      <Section tone="alt">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          <div>
            <SectionHead eyebrow="Detalle" title="Especificaciones" />
            <dl className="border-t border-[var(--bd-2)] divide-y divide-[var(--bd-1)]">
              {Object.entries(product.specs).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-6 py-4">
                  <dt className="text-[14px] text-[var(--fg-3)]">{k}</dt>
                  <dd className="text-[14px] font-medium text-[var(--fg-1)] text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <SectionHead eyebrow="Costos" title="Qué pagás y a quién" />
            <div className="space-y-5 text-[15px] leading-[1.75] text-[var(--fg-3)] border-t border-[var(--bd-2)] pt-6">
              <p><span className="font-medium text-[var(--fg-1)]">En la tienda:</span> el producto, con tus propios medios de pago.</p>
              <p><span className="font-medium text-[var(--fg-1)]">A Optimus, en la sucursal:</span> la comisión de gestión y el envío por kilo.</p>
              <p><span className="font-medium text-[var(--fg-1)]">En Cuba:</span> la aduana, que paga el destinatario al recibir.</p>
              <Link to="/como-comprar" className="link-arrow">Ver cómo comprar</Link>
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section>
          <SectionHead eyebrow="Seguí explorando" title="También te puede interesar" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-12 sm:gap-x-8">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </Section>
      )}
    </div>
  )
}
