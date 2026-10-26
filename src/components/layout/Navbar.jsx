import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Menu, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoginModal from '../auth/LoginModal'
import ThemeToggle from '../ui/ThemeToggle'

const LINKS = [
  { to: '/como-comprar', label: 'Cómo comprar' },
  { to: '/catalogo', label: 'Tiendas y productos' },
  { to: '/tarifas', label: 'Tarifas' },
  { to: '/seguimiento', label: 'Consultar compra' },
]

const linkCls = ({ isActive }) =>
  `relative py-2 text-[13px] font-medium tracking-[0.02em] transition-colors duration-300 ${
    isActive ? 'text-[var(--fg-1)]' : 'text-[var(--fg-3)] hover:text-[var(--fg-1)]'
  } after:absolute after:left-0 after:-bottom-0.5 after:h-px after:bg-[var(--color-brand)] after:transition-all after:duration-500 ${
    isActive ? 'after:w-full' : 'after:w-0 hover:after:w-full'
  }`

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginMode, setLoginMode] = useState('login')

  // El logo a color (rojo y gris) se ve bien sobre fondo claro y oscuro: no se usa la versión blanca.
  const logo = '/logoLight.png'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const openLogin = (e) => { setLoginMode(e.detail?.mode === 'register' ? 'register' : 'login'); setLoginOpen(true) }
    window.addEventListener('open-login', openLogin)
    return () => window.removeEventListener('open-login', openLogin)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div
        className={`transition-[background-color,border-color] duration-500 backdrop-blur-xl ${
          scrolled || menuOpen ? 'bg-[var(--bg-base)]/90 border-b border-[var(--bd-1)]' : 'bg-[var(--bg-base)]/60 border-b border-transparent'
        }`}
      >
        <nav className="container-x h-[72px] md:h-20 flex items-center gap-6 lg:gap-10" aria-label="Principal">
          <Link to="/" className="flex items-center shrink-0" aria-label="Optimus Envíos — Inicio">
            <img src={logo} alt="Optimus Envíos" className="h-8 sm:h-9 w-auto block" />
          </Link>

          <div className="hidden md:flex items-center gap-7 lg:gap-9 ml-2">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <div className="hidden sm:block"><ThemeToggle /></div>

            {isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-1 ml-1">
                <Link
                  to="/cuenta"
                  className="flex items-center gap-2 h-11 px-3 rounded-lg text-[13px] font-medium text-[var(--fg-1)] hover:bg-[var(--bd-1)] transition-colors duration-300"
                >
                  <User size={16} strokeWidth={1.5} />
                  <span className="max-w-[120px] truncate">{user.name.split(' ')[0]}</span>
                </Link>
                <button
                  onClick={logout}
                  aria-label="Cerrar sesión"
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--fg-3)] hover:text-[var(--err-text)] hover:bg-[var(--bd-1)] transition-colors duration-300 cursor-pointer"
                >
                  <LogOut size={16} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setLoginMode('login'); setLoginOpen(true) }}
                className="inline-flex items-center h-11 px-4 sm:px-5 ml-1 rounded-lg border border-[var(--bd-3)] hover:border-[var(--fg-1)] font-sans font-semibold text-[15px] text-[var(--fg-1)] transition-colors duration-300 cursor-pointer"
              >
                Ingresar
              </button>
            )}

            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menú"
              aria-expanded={menuOpen}
              className="md:hidden w-11 h-11 flex items-center justify-center rounded-lg text-[var(--fg-1)] hover:bg-[var(--bd-1)] transition-colors cursor-pointer"
            >
              {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            </button>
          </div>
        </nav>

      </div>

      {/* Menú móvil: tipografía grande y mucho aire */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="md:hidden fixed inset-x-0 top-[72px] bottom-0 bg-[var(--bg-base)] overflow-y-auto"
          >
            <div className="container-x py-10 flex flex-col">
              {[...LINKS, { to: '/contacto', label: 'Contacto' }].map((l, i) => (
                <motion.div key={l.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                  <Link to={l.to} className="block py-5 border-b border-[var(--bd-1)] font-display font-extrabold text-[1.625rem] tracking-[-0.02em] text-[var(--fg-1)]">
                    {l.label}
                  </Link>
                </motion.div>
              ))}
              <div className="pt-8 flex flex-col gap-4">
                <div className="flex items-center justify-between text-[15px] text-[var(--fg-3)]">
                  Tema
                  <ThemeToggle />
                </div>
                {isAuthenticated ? (
                  <>
                    <Link to="/cuenta" className="text-[15px] font-medium text-[var(--fg-2)]">Mi cuenta ({user.name.split(' ')[0]})</Link>
                    <Link to="/casillero" className="text-[15px] font-medium text-[var(--fg-2)]">Mis compras y recepción</Link>
                    <button onClick={logout} className="text-left text-[15px] font-medium text-[var(--err-text)] cursor-pointer">Cerrar sesión</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setMenuOpen(false); setLoginMode('login'); setLoginOpen(true) }}
                    className="h-12 rounded-lg bg-[#E31E24] text-white font-sans font-semibold text-[15px] cursor-pointer"
                  >
                    Ingresar / Registrarse
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} initialMode={loginMode} />
    </motion.header>
  )
}
