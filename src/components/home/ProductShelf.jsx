import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ProductCard from '../ui/ProductCard'

/**
 * Fila de productos reutilizable (estilo Amazon/Best Buy).
 * Grid denso en desktop; scroll horizontal con snap en mobile.
 */
export default function ProductShelf({ title, accent = '#F07232', products, viewAllTo = '/catalogo', eyebrow }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          {eyebrow && <span className="block text-[11px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: accent }}>{eyebrow}</span>}
          <h2 className="font-display font-bold text-[18px] sm:text-xl text-[var(--fg-1)]">{title}</h2>
        </div>
        <Link to={viewAllTo} className="group inline-flex items-center gap-1.5 text-[13px] font-semibold shrink-0 transition-colors" style={{ color: accent }}>
          Ver todo
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Mobile: horizontal scroll · Desktop: grid */}
      <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
        {products.map((p, i) => (
          <div key={p.id} className="snap-start shrink-0 w-[44vw] min-[480px]:w-[40vw] sm:w-auto">
            <ProductCard product={p} index={i} />
          </div>
        ))}
      </div>
    </section>
  )
}
