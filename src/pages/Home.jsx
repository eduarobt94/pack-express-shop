import Hero from '../components/home/Hero'
import HowItWorks from '../components/home/HowItWorks'
import QuoteSection from '../components/home/QuoteSection'
import StoresSection from '../components/home/StoresSection'

/** Orden por frecuencia de uso: entender → calcular/rastrear/registrarse → proceso → dónde comprar. */
export default function Home() {
  return (
    <div>
      <Hero />
      <QuoteSection />
      <HowItWorks />
      <StoresSection />
    </div>
  )
}
