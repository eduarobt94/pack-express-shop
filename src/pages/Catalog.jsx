import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, X, Check } from 'lucide-react'
import { products } from '../data/products'
import { categories } from '../data/categories'
import { searchAmazon } from '../lib/marketplaces/amazonAdapter'
import { MARKETPLACES } from '../lib/marketplaces/types'
import ProductCard from '../components/ui/ProductCard'
import { ProductCardSkeleton } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { PageHeader } from '../components/ui/Layout'

const SORTS = [
  { id: 'featured', label: 'Destacados' },
  { id: 'price-asc', label: 'Precio: menor a mayor' },
  { id: 'price-desc', label: 'Precio: mayor a menor' },
]

const brands = [...new Set(products.map((p) => p.brand))]

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const activeCat = params.get('cat') || 'all'
  const query = params.get('q') || ''
  const marketplace = params.get('marketplace')
  const isAmazon = marketplace === 'amazon'

  const [sort, setSort] = useState('featured')
  const [selectedBrands, setSelectedBrands] = useState([])
  const [onlyStock, setOnlyStock] = useState(false)
  const [search, setSearch] = useState(query)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [amazonProducts, setAmazonProducts] = useState([])

  // Modo marketplace: cargar productos de Amazon (async, con caché en el adapter)
  useEffect(() => {
    if (!isAmazon) return
    let active = true
    setLoading(true)
    searchAmazon(search).then((list) => {
      if (active) { setAmazonProducts(list); setLoading(false) }
    })
    return () => { active = false }
  }, [isAmazon, search])

  // Modo local: skeleton simulado
  useEffect(() => {
    if (isAmazon) return
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 650)
    return () => clearTimeout(t)
  }, [isAmazon, activeCat, sort, selectedBrands, onlyStock, search])

  function setCat(cat) {
    const next = new URLSearchParams(params)
    if (cat === 'all') next.delete('cat')
    else next.set('cat', cat)
    setParams(next)
  }

  const filtered = useMemo(() => {
    // Modo marketplace: la búsqueda ya la hizo el adapter; aquí solo ordenamos
    if (isAmazon) {
      const list = amazonProducts.slice()
      switch (sort) {
        case 'price-asc': list.sort((a, b) => a.price - b.price); break
        case 'price-desc': list.sort((a, b) => b.price - a.price); break
          default: break
      }
      return list
    }

    let list = products.slice()
    if (activeCat !== 'all') list = list.filter((p) => p.category === activeCat)
    if (selectedBrands.length) list = list.filter((p) => selectedBrands.includes(p.brand))
    if (onlyStock) list = list.filter((p) => p.available !== false)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q),
      )
    }
    switch (sort) {
      case 'price-asc': list.sort((a, b) => a.price - b.price); break
      case 'price-desc': list.sort((a, b) => b.price - a.price); break
      default: break
    }
    return list
  }, [isAmazon, amazonProducts, activeCat, selectedBrands, onlyStock, search, sort])

  const catName = isAmazon
    ? `Catálogo de ${MARKETPLACES.amazon.name}`
    : categories.find((c) => c.slug === activeCat)?.name || 'Todos los productos'

  function toggleBrand(b) {
    setSelectedBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))
  }

  const FilterPanel = (
    <div className="space-y-10">
      <div>
        <h4 className="eyebrow before:hidden mb-4">Categoría</h4>
        <div className="space-y-0.5">
          {[{ slug: 'all', name: 'Todas' }, ...categories].map((c) => (
            <button
              key={c.slug}
              onClick={() => setCat(c.slug)}
              className={`w-full text-left py-2 text-[14px] transition-colors duration-300 cursor-pointer ${
                activeCat === c.slug ? 'text-[var(--brand-text)] font-semibold' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="eyebrow before:hidden mb-4">Marca</h4>
        <div className="space-y-1.5">
          {brands.map((b) => (
            <label key={b} className="flex items-center gap-2.5 px-1 py-1 cursor-pointer group">
              <span
                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  selectedBrands.includes(b) ? 'bg-[#E31E24] border-[#E31E24]' : 'border-[var(--bd-3)] group-hover:border-[var(--bd-4)]'
                }`}
              >
                {selectedBrands.includes(b) && <Check size={11} className="text-white" />}
              </span>
              <input type="checkbox" className="sr-only" checked={selectedBrands.includes(b)} onChange={() => toggleBrand(b)} />
              <span className="text-[13.5px] text-[var(--fg-2)]">{b}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="eyebrow before:hidden mb-4">Disponibilidad</h4>
        <label className="flex items-center gap-2.5 px-1 py-1 cursor-pointer group">
          <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${onlyStock ? 'bg-[#E31E24] border-[#E31E24]' : 'border-[var(--bd-3)]'}`}>
            {onlyStock && <Check size={11} className="text-white" />}
          </span>
          <input type="checkbox" className="sr-only" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
          <span className="text-[13.5px] text-[var(--fg-2)]">Solo disponibles</span>
        </label>
      </div>
    </div>
  )

  return (
    <div className="pt-0">
      <PageHeader
        eyebrow={isAmazon ? 'Conectado a Amazon' : 'Catálogo'}
        title={catName}
        lead={`${filtered.length} productos para comprar en la tienda y enviar a Cuba`}
      />

      <div className={`container-x pb-24 md:pb-32 grid grid-cols-1 gap-12 ${isAmazon ? 'lg:grid-cols-1' : 'lg:grid-cols-[220px_1fr] lg:gap-16'}`}>
        {/* Sidebar (desktop) — solo en modo local */}
        {!isAmazon && (
          <aside className="hidden lg:block">
            <div className="sticky top-24">{FilterPanel}</div>
          </aside>
        )}

        <div className="min-w-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10 pb-6 border-b border-[var(--bd-2)]">
            <div className="flex-1 flex items-center gap-3 border-b border-[var(--bd-3)] focus-within:border-[var(--color-brand)] transition-colors duration-300">
              <Search size={16} className="text-[var(--fg-4)] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, marca..."
                aria-label="Buscar por nombre o marca"
                className="flex-1 bg-transparent text-[15px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none py-3"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda" className="text-[var(--fg-4)] hover:text-[var(--fg-1)]">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="flex gap-2 min-w-0">
              {!isAmazon && (
                <button
                  onClick={() => setShowFilters(true)}
                  className="lg:hidden flex items-center gap-2 px-4 h-11 rounded-lg border border-[var(--bd-2)] text-sm font-medium text-[var(--fg-2)] cursor-pointer"
                >
                  <SlidersHorizontal size={15} /> Filtros
                </button>
              )}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Ordenar"
                className="min-w-0 flex-1 sm:flex-none px-4 h-11 rounded-lg border border-[var(--bd-2)] bg-[var(--bg-base)] text-sm font-medium text-[var(--fg-1)] outline-none cursor-pointer focus:border-[var(--color-brand)]"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-12 sm:gap-x-8">
              {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="SearchX"
              title="No encontramos productos"
              description="Prueba con otros filtros o términos de búsqueda diferentes."
              action={
                <Button variant="subtle" size="sm" onClick={() => { setSearch(''); setSelectedBrands([]); setOnlyStock(false); setCat('all') }}>
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-12 sm:gap-x-8">
              {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-0 bottom-0 w-[300px] max-w-[85vw] bg-[var(--bg-base)] border-r border-[var(--bd-2)] p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-bold text-lg text-[var(--fg-1)]">Filtros</h3>
              <button onClick={() => setShowFilters(false)} aria-label="Cerrar" className="text-[var(--fg-3)]"><X size={20} /></button>
            </div>
            {FilterPanel}
            <Button className="w-full mt-8" onClick={() => setShowFilters(false)}>Ver {filtered.length} productos</Button>
          </motion.div>
        </div>
      )}
    </div>
  )
}
