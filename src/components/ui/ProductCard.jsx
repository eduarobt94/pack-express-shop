import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, ChevronRight } from 'lucide-react'
import ProductVisual from './ProductVisual'
import Badge from './Badge'
import Stars from './Stars'
import MarketplaceBadge from './MarketplaceBadge'
import { formatUSD } from '../../lib/format'

/**
 * Tarjeta de producto. Soporta dos formas:
 *  - Producto local (data/products.js): navega al detalle interno
 *  - MarketplaceProduct (Amazon…): navega al detalle con ?marketplace y enlaza a la tienda
 * @param {{ product: any, index?: number }} props
 */
export default function ProductCard({ product, index = 0 }) {
  const isMarketplace = Boolean(product.marketplace)

  // Normaliza los campos que difieren entre producto local y de marketplace
  const name = product.title || product.name
  const tagline = product.description || product.tagline
  const icon = product.icon
  const tint = product.tint
  const price = product.price
  const rating = isMarketplace ? product.rating : null
  const soldOut = isMarketplace && product.available === false

  const detailTo = isMarketplace
    ? `/producto/${product.asin}?marketplace=${product.marketplace}`
    : `/producto/${product.id}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={detailTo}
        className="group block card-surface rounded-2xl overflow-hidden hover:border-[var(--bd-3)] hover:shadow-[var(--shadow-hover)] transition-all duration-300"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.06]">
            <ProductVisual icon={icon} tint={tint} />
          </div>
          {product.badge && (
            <div className="absolute top-3 left-3 z-10">
              <Badge>{product.badge}</Badge>
            </div>
          )}
          {isMarketplace && (
            <div className="absolute top-3 left-3 z-10">
              <MarketplaceBadge marketplace={product.marketplace} />
            </div>
          )}
          {soldOut && (
            <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-lg text-[11px] font-bold text-white bg-[var(--fg-4)]">
              No disponible
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-4)]">
              {product.brand}
            </span>
            {typeof rating === 'number' && <Stars rating={rating} size={11} showValue />}
          </div>

          <h3 className="font-display font-semibold text-[15px] text-[var(--fg-1)] leading-snug mb-1 line-clamp-1 group-hover:text-[#E31E24] transition-colors">
            {name}
          </h3>
          <p className="text-[12.5px] text-[var(--fg-3)] line-clamp-1 mb-3.5">{tagline}</p>

          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-lg text-[var(--fg-1)]">{formatUSD(price)}</span>
              </div>
              <span className="text-[11px] text-[var(--fg-3)] font-medium">+ comisión y envío por kilo</span>
            </div>

            <span
              aria-hidden
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--bd-2)] text-[var(--fg-2)] group-hover:bg-[#E31E24] group-hover:text-white group-hover:border-[#E31E24] transition-all duration-300 shrink-0"
            >
              {isMarketplace ? <ExternalLink size={16} /> : <ChevronRight size={18} />}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
