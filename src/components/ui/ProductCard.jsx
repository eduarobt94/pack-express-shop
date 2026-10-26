import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatUSD } from '../../lib/format'
import { EASE } from './Layout'
import MarketplaceBadge from './MarketplaceBadge'
import ProductVisual from './ProductVisual'
import Stars from './Stars'

/**
 * Tarjeta de producto, acabado editorial: imagen en proporción 4:5, texto sin caja, línea fina y un solo gesto de hover.
 * Soporta producto local (data/products.js) y MarketplaceProduct (Amazon…).
 * @param {{ product: any, index?: number }} props
 */
export default function ProductCard({ product, index = 0 }) {
  const isMarketplace = Boolean(product.marketplace)

  const name = product.title || product.name
  const tagline = product.description || product.tagline
  const rating = isMarketplace ? product.rating : null
  const soldOut = isMarketplace && product.available === false

  const detailTo = isMarketplace
    ? `/producto/${product.asin}?marketplace=${product.marketplace}`
    : `/producto/${product.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.8, delay: Math.min(index * 0.06, 0.3), ease: EASE }}
    >
      <Link to={detailTo} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-[var(--bd-1)] group-hover:border-[var(--bd-3)] group-hover:shadow-[var(--shadow-hover)] transition-[border-color,box-shadow] duration-500">
          <div className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]">
            <ProductVisual icon={product.icon} />
          </div>
          {isMarketplace && (
            <div className="absolute top-4 left-4 z-10">
              <MarketplaceBadge marketplace={product.marketplace} />
            </div>
          )}
          {soldOut && (
            <span className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-[11px] font-medium bg-[var(--bg-base)] text-[var(--fg-3)] border border-[var(--bd-2)]">
              No disponible
            </span>
          )}
          <span className="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full bg-[var(--bg-base)] text-[var(--fg-1)] border border-[var(--bd-2)] flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500" aria-hidden="true">
            <ArrowUpRight size={16} strokeWidth={1.5} />
          </span>
        </div>

        <div className="pt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="eyebrow !tracking-[0.14em] before:hidden">{product.brand}</p>
            {typeof rating === 'number' && <Stars rating={rating} size={11} showValue />}
          </div>
          <h3 className="font-display font-extrabold text-[1.0625rem] leading-snug tracking-[-0.01em] text-[var(--fg-1)] line-clamp-2 group-hover:text-[var(--brand-text)] transition-colors duration-500">
            {name}
          </h3>
          <p className="mt-2 text-[14px] leading-[1.6] text-[var(--fg-3)] line-clamp-2">{tagline}</p>
          <p className="mt-5 flex items-baseline gap-3">
            <span className="font-display font-bold text-lg tabular-nums text-[var(--fg-1)]">{formatUSD(product.price)}</span>
          </p>
          <p className="mt-1 text-[13px] text-[var(--fg-4)]">+ comisión y envío por kilo</p>
        </div>
      </Link>
    </motion.div>
  )
}
