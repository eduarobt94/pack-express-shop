import CompactHero from '../components/home/CompactHero'
import CategoryStrip from '../components/home/CategoryStrip'
import StoresSection from '../components/home/StoresSection'
import ProductShelf from '../components/home/ProductShelf'
import BenefitsCompact from '../components/home/BenefitsCompact'
import { products } from '../data/products'

export default function Home() {
  return (
    <div className="pb-10">
      <CompactHero />
      <CategoryStrip />

      {/* Tiendas externas */}
      <StoresSection />

      {/* Catálogo orientativo */}
      <ProductShelf title="Selección orientativa" eyebrow="Productos útiles" accent="#E31E24" products={products} viewAllTo="/catalogo" />

      <BenefitsCompact />
    </div>
  )
}
