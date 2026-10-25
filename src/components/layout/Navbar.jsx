import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Search, User, MapPin, Warehouse, LogOut } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { categories } from '../../data/categories'
import ThemeToggle from '../ui/ThemeToggle'
import LoginModal from '../auth/LoginModal'

export default function Navbar() {
  const { theme } = useTheme()
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loginOpen, setLoginOpen] = useState(false)

  const logo = theme === 'dark' ? '/logoDark.png' : '/logoLight.png'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location.pathname, location.search])

  function search(e) {
    e?.preventDefault()
    navigate(q.trim() ? `/catalogo?q=${encodeURIComponent(q.trim())}` : '/catalogo')
  }

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div
        className={`transition-all duration-300 ${
          scrolled ? 'bg-[var(--bg-base)]/85 backdrop-blur-xl border-b border-[var(--bd-1)]' : 'bg-[var(--bg-base)]/70 backdrop-blur-md border-b border-[var(--bd-1)]'
        }`}
        style={{ boxShadow: scrolled ? 'var(--shadow-navbar)' : 'none' }}
      >
        {/* Main bar */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3 sm:gap-5">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0" aria-label="Optimus Envíos — Inicio">
            <img src={logo} alt="Optimus Envíos" className="h-9 sm:h-10 w-auto block" />
          </Link>

          {/* Global search — prominent (desktop) */}
          <form onSubmit={search} className="hidden md:flex flex-1 max-w-2xl items-center h-11 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] focus-within:border-[#E31E24]/60 focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all overflow-hidden">
            <Search size={17} className="text-[var(--fg-4)] ml-3.5 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca EcoFlow, bicicletas eléctricas, laptops..."
              aria-label="Buscar productos"
              className="flex-1 bg-transparent px-3 text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none min-w-0"
            />
            <button type="submit" className="h-full px-5 bg-[#E31E24] hover:bg-[#C81A1F] text-white text-sm font-semibold transition-colors cursor-pointer">
              Buscar
            </button>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto md:ml-0">
            <Link
              to="/seguimiento"
              className="hidden lg:flex items-center gap-1.5 px-3 h-10 rounded-xl border border-[var(--bd-2)] text-[13px] font-medium text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:border-[var(--bd-3)] transition-colors"
            >
              <MapPin size={15} /> Rastrear
            </Link>
            <Link
              to="/casillero"
              className="hidden lg:flex items-center gap-1.5 px-3 h-10 rounded-xl border border-[var(--sec)]/30 bg-[var(--sec)]/[0.06] text-[13px] font-semibold text-[var(--sec)] hover:bg-[var(--sec)]/[0.12] transition-colors"
            >
              <Warehouse size={15} /> Casillero
            </Link>
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/cuenta"
                  className="flex items-center gap-2 h-10 px-3 rounded-xl border border-[var(--bd-2)] text-[13px] font-medium text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:border-[var(--bd-3)] transition-colors"
                >
                  <User size={15} />
                  <span className="hidden xl:block max-w-[120px] truncate">{user.name.split(' ')[0]}</span>
                </Link>
                <button
                  onClick={logout}
                  aria-label="Cerrar sesión"
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--bd-2)] text-[var(--fg-3)] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors cursor-pointer"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="hidden sm:flex items-center gap-1.5 h-10 px-4 rounded-xl border border-[var(--bd-2)] text-[13px] font-semibold text-[var(--fg-1)] hover:border-[var(--sec)]/50 hover:bg-[var(--sec)]/[0.06] hover:text-[var(--sec)] transition-colors cursor-pointer"
              >
                <User size={15} /> Ingresar
              </button>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Menú"
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-[var(--bd-2)] text-[var(--fg-2)]"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Category bar (desktop) */}
        <div className="hidden md:block border-t border-[var(--bd-1)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-11 flex items-center gap-1">
            <Link to="/catalogo" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[var(--fg-1)] hover:bg-[var(--bd-1)] transition-colors">
              <Menu size={15} /> Todas las categorías
            </Link>
            <span className="w-px h-4 bg-[var(--bd-2)] mx-1.5" />
            {categories.map((c) => (
              <NavLink
                key={c.slug}
                to={`/catalogo?cat=${c.slug}`}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--fg-2)] hover:text-[#E31E24] hover:bg-[var(--bd-1)] transition-colors whitespace-nowrap"
              >
                {c.short}
              </NavLink>
            ))}
            <Link to="/catalogo?cat=ofertas" className="ml-auto px-3 py-1.5 rounded-lg text-[13px] font-bold text-[#E31E24] hover:bg-[#E31E24]/[0.08] transition-colors">
              Ofertas
            </Link>
          </div>
        </div>

        {/* Mobile search (always visible under bar) */}
        <form onSubmit={search} className="md:hidden px-4 pb-3 pt-1">
          <div className="flex items-center h-11 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] focus-within:border-[#E31E24]/60 transition-colors overflow-hidden">
            <Search size={17} className="text-[var(--fg-4)] ml-3.5 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar productos..."
              aria-label="Buscar productos"
              className="flex-1 bg-transparent px-3 text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none min-w-0"
            />
            <button type="submit" className="h-full px-4 bg-[#E31E24] text-white text-sm font-semibold cursor-pointer">Buscar</button>
          </div>
        </form>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden bg-[var(--bg-base)]/95 backdrop-blur-xl border-b border-[var(--bd-1)]"
          >
            <div className="px-4 py-3 flex flex-col gap-0.5">
              <Link to="/catalogo" className="px-3 py-3 rounded-lg text-sm font-semibold text-[var(--fg-1)] hover:bg-[var(--bd-1)]">Todas las categorías</Link>
              {categories.map((c) => (
                <Link key={c.slug} to={`/catalogo?cat=${c.slug}`} className="px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--fg-2)] hover:bg-[var(--bd-1)] transition-colors">
                  {c.name}
                </Link>
              ))}
              <div className="h-px bg-[var(--bd-1)] my-2" />
              <Link to="/seguimiento" className="px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--fg-2)] hover:bg-[var(--bd-1)]">Rastrear pedido</Link>
              <Link to="/casillero" className="px-3 py-2.5 rounded-lg text-sm font-semibold text-[var(--sec)] hover:bg-[var(--sec)]/[0.08]">Mi Casillero</Link>
              {isAuthenticated ? (
                <>
                  <Link to="/cuenta" className="px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--fg-2)] hover:bg-[var(--bd-1)]">Mi cuenta ({user.name.split(' ')[0]})</Link>
                  <button onClick={logout} className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/[0.08] cursor-pointer">Cerrar sesión</button>
                </>
              ) : (
                <button onClick={() => { setOpen(false); setLoginOpen(true) }} className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[var(--sec)] hover:bg-[var(--sec)]/[0.08] cursor-pointer">Ingresar / Registrarse</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
      />
    </motion.header>
  )
}
