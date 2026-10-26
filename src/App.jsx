import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import MobileActionBar from './components/layout/MobileActionBar'
import Home from './pages/Home'
import { AuthProvider } from './context/AuthContext'

const Catalog = lazy(() => import('./pages/Catalog'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Tracking = lazy(() => import('./pages/Tracking'))
const Account = lazy(() => import('./pages/Account'))
const Locker = lazy(() => import('./pages/Locker'))
const HowToBuy = lazy(() => import('./pages/HowToBuy'))
const Rates = lazy(() => import('./pages/Rates'))
const Contact = lazy(() => import('./pages/Contact'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
  }, [pathname])
  return null
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--bd-3)] border-t-[#E31E24] animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#E31E24] focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Ir al contenido principal
      </a>
      <Navbar />
      <main id="main" role="main" className="min-h-screen pt-[72px] md:pt-20">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/producto/:id" element={<ProductDetail />} />
            <Route path="/seguimiento" element={<Tracking />} />
            <Route path="/seguimiento/:order" element={<Tracking />} />
            <Route path="/cuenta" element={<Account />} />
            <Route path="/casillero" element={<Locker />} />
            <Route path="/como-comprar" element={<HowToBuy />} />
            <Route path="/tarifas" element={<Rates />} />
            <Route path="/contacto" element={<Contact />} />
            <Route path="/restablecer" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <MobileActionBar />
    </MotionConfig>
    </AuthProvider>
  )
}
