import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { EASE } from '../ui/Layout'

const rise = (delay) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, delay, ease: EASE },
})

/**
 * Primer pantallazo: qué es, desde dónde y hacia dónde, quién paga qué (una línea) y las tres acciones más
 * frecuentes: registrarse, calcular el costo y rastrear una compra.
 */
export default function Hero() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  function track(e) {
    e.preventDefault()
    const c = code.trim()
    navigate(c ? `/seguimiento/${encodeURIComponent(c)}` : '/seguimiento')
  }

  return (
    <section className="hero-glow border-b border-[var(--bd-1)]">
      <div className="container-x pt-8 sm:pt-20 lg:pt-24 pb-16 sm:pb-24">
      <motion.p {...rise(0.05)} className="eyebrow mb-5 sm:mb-8">Uruguay → Cuba</motion.p>
      <motion.h1 {...rise(0.15)} className="display text-[var(--fg-1)] max-w-[18ch]">
        <span className="grad-ink">Del exterior</span>{' '}<br /><span className="grad-red">a casa de tu familia.</span>
      </motion.h1>
      <motion.p {...rise(0.3)} className="lead mt-5 sm:mt-8 max-w-[52ch]">
        Pagás el producto en la tienda. Nosotros gestionamos el envío, con atención presencial en nuestra sucursal.
      </motion.p>

      <motion.div {...rise(0.45)} className="mt-8 sm:mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Button onClick={() => window.dispatchEvent(new CustomEvent('open-login', { detail: { mode: 'register' } }))} size="lg">
          Crear mi cuenta <ArrowRight size={16} strokeWidth={2} />
        </Button>
        <Button to="/catalogo" variant="outline" size="lg">Ver tiendas</Button>
        <a href="#cotizador" className="link-arrow">Calcular mi envío</a>
      </motion.div>
      <motion.p {...rise(0.5)} className="mt-5 text-[13px] text-[var(--fg-4)]">La aduana de Cuba la paga quien recibe.</motion.p>

      <motion.form {...rise(0.6)} onSubmit={track} role="search" aria-label="Consultar una compra" className="mt-8 sm:mt-14 max-w-[560px]">
        <label htmlFor="home-track" className="eyebrow before:hidden block mb-3">Consultar una compra</label>
        <div className="flex items-end gap-4 border-b border-[var(--bd-3)] focus-within:border-[var(--color-brand)] transition-colors duration-300">
          <input
            id="home-track"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: OPT-HAB-2026-00847"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent h-12 text-[16px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
          />
          <button type="submit" className="link-arrow h-12 shrink-0 cursor-pointer">Consultar →</button>
        </div>
      </motion.form>
      </div>
    </section>
  )
}
