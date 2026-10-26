import { Link } from 'react-router-dom'

const COLS = [
  {
    title: 'Antes de enviar',
    links: [
      { label: 'Tarifas y calculadora', to: '/tarifas' },
      { label: 'Cómo comprar', to: '/como-comprar' },
      { label: 'Tiendas', to: '/catalogo' },
    ],
  },
  {
    title: 'Mi cuenta',
    links: [
      { label: 'Consultar una compra', to: '/seguimiento' },
      { label: 'Mi cuenta', to: '/cuenta' },
      { label: 'Mis compras y recepción', to: '/casillero' },
    ],
  },
  {
    title: 'Ayuda',
    links: [{ label: 'Contacto y condiciones', to: '/contacto' }],
  },
]

export default function Footer() {
  // El logo a color (rojo y gris) se ve bien sobre fondo claro y oscuro: no se usa la versión blanca.
  const logo = '/logoLight.png'
  return (
    <footer className="bg-[var(--bg-alt)] border-t border-[var(--bd-1)] pb-16 md:pb-0">
      <div className="container-x pt-16 sm:pt-20 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12 lg:gap-16">
          <div>
            <Link to="/" className="inline-flex" aria-label="Optimus Envíos — Inicio">
              <img src={logo} alt="Optimus Envíos" className="h-10 w-auto block" />
            </Link>
            <p className="mt-6 text-[15px] leading-[1.75] text-[var(--fg-3)] max-w-[34ch]">
              Atención y cobro presencial en nuestra sucursal de Uruguay.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              <a href="mailto:[EMAIL]" className="link-arrow">Email</a>
              <a href="https://wa.me/[WHATSAPP]" target="_blank" rel="noopener noreferrer" className="link-arrow">WhatsApp</a>
            </div>
          </div>

          {COLS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="eyebrow mb-6">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="inline-block py-1 text-[15px] text-[var(--fg-2)] hover:text-[var(--brand-text)] transition-colors duration-300">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-[var(--bd-1)] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-[13px] text-[var(--fg-4)]">
          <p>© 2026 Optimus Envíos</p>
          <p>Demo de validación · Datos simulados</p>
        </div>
      </div>
    </footer>
  )
}
