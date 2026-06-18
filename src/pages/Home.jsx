import CompactHero from '../components/home/CompactHero'
import CategoryStrip from '../components/home/CategoryStrip'
import StoresSection from '../components/home/StoresSection'
import ProductShelf from '../components/home/ProductShelf'
import SpecialOffers from '../components/home/SpecialOffers'
import BenefitsCompact from '../components/home/BenefitsCompact'
import { bestSellers, offers, recommended, recentlyAdded } from '../data/products'

export default function Home() {
  return (
    <div className="pb-10">
      {/* Above the fold: promo compacta + categorías + productos */}
      <CompactHero />
      <CategoryStrip />

      {/* Marketplaces disponibles */}
      <StoresSection />

      {/* Conversión: filas de productos */}
      <ProductShelf title="Los más vendidos" eyebrow="Top ventas" accent="#F07232" products={bestSellers} viewAllTo="/catalogo" />
      <SpecialOffers products={offers} />
      <ProductShelf title="Recomendados para ti" eyebrow="Para ti" accent="#527ED8" products={recommended} viewAllTo="/catalogo" />
      <ProductShelf title="Recién agregados" eyebrow="Nuevo" accent="#F07232" products={recentlyAdded} viewAllTo="/catalogo" />

      {/* Confianza (compacta) */}
      <BenefitsCompact />
    </div>
  )
}
