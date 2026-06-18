import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Zap, ArrowRight } from 'lucide-react'
import ProductCard from '../ui/ProductCard'

function useCountdown(targetHour = 6) {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 })
  useEffect(() => {
    const end = Date.now() + targetHour * 3600 * 1000
    const tick = () => {
      const diff = Math.max(0, end - Date.now())
      setT({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetHour])
  return t
}

const pad = (n) => String(n).padStart(2, '0')

export default function SpecialOffers({ products }) {
  const { h, m, s } = useCountdown(6)
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
      <div className="rounded-2xl border border-[#F07232]/25 overflow-hidden" style={{ background: 'radial-gradient(120% 120% at 0% 0%, rgba(240,114,50,0.10), transparent 50%), var(--bg-card)' }}>
        {/* Flash header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--bd-1)]">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#F07232] text-white">
              <Zap size={18} />
            </span>
            <div>
              <h2 className="font-display font-bold text-[17px] sm:text-lg text-[var(--fg-1)] leading-none">Ofertas del momento</h2>
              <span className="text-[12px] text-[var(--fg-3)]">Precios especiales por tiempo limitado</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[var(--fg-3)] hidden sm:block">Termina en</span>
            <div className="flex items-center gap-1">
              {[pad(h), pad(m), pad(s)].map((v, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--bd-2)] flex items-center justify-center font-display font-bold text-[15px] text-[var(--fg-1)] tabular-nums">
                    {v}
                  </span>
                  {i < 2 && <span className="text-[#F07232] font-bold">:</span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Offer products */}
        <div className="p-4 sm:p-5">
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {products.map((p, i) => (
              <div key={p.id} className="snap-start shrink-0 w-[44vw] min-[480px]:w-[40vw] sm:w-auto">
                <ProductCard product={p} index={i} />
              </div>
            ))}
          </div>
          <Link to="/catalogo" className="group flex sm:hidden items-center justify-center gap-1.5 mt-4 text-[13px] font-semibold text-[#F07232]">
            Ver todas las ofertas <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  )
}
