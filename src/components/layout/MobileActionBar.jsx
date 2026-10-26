import { Calculator, PackageSearch } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

/**
 * Barra fija inferior solo en móvil: las dos acciones más frecuentes siempre a un toque.
 * WhatsApp se sumará cuando exista el número real (ver docs/pendientes.md); no se publica un botón a un placeholder.
 */
export default function MobileActionBar() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/seguimiento') || pathname.startsWith('/tarifas')) return null
  const item =
    'flex-1 h-14 flex items-center justify-center gap-2.5 font-sans font-semibold text-[15px] text-[var(--fg-1)]'
  return (
    <nav
      aria-label="Acciones rápidas"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-[var(--bg-base)]/95 backdrop-blur-xl border-t border-[var(--bd-2)] pb-[env(safe-area-inset-bottom)]"
    >
      <Link to="/seguimiento" className={`${item} border-r border-[var(--bd-1)]`}>
        <PackageSearch size={18} strokeWidth={1.5} aria-hidden="true" /> Consultar
      </Link>
      <Link to="/tarifas" className={item}>
        <Calculator size={18} strokeWidth={1.5} aria-hidden="true" /> Calcular
      </Link>
    </nav>
  )
}
