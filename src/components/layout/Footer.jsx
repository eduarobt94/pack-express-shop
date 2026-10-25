import { Link } from 'react-router-dom'
import { Shield, Plane, Package, Headset, Mail, MessageCircle } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const COLS = [
  {
    title: 'Tienda',
    links: [
      { label: 'Tiendas y productos', to: '/catalogo' },
      { label: 'Energía y respaldo eléctrico', to: '/catalogo?cat=energia-respaldo' },
      { label: 'Iluminación', to: '/catalogo?cat=iluminacion' },
      { label: 'Cocina y utensilios', to: '/catalogo?cat=cocina' },
    ],
  },
  {
    title: 'Servicio',
    links: [
      { label: 'Cómo comprar', to: '/como-comprar' },
      { label: 'Tarifas y calculadora', to: '/tarifas' },
      { label: 'Consultar una compra', to: '/seguimiento' },
      { label: 'Mi cuenta', to: '/cuenta' },
      { label: 'Contacto y condiciones', to: '/contacto' },
    ],
  },
]

const TRUST = [
  { Icon: Shield, label: 'No pedimos tarjetas de tiendas' },
  { Icon: Plane, label: 'Entrega en Cuba' },
  { Icon: Package, label: 'Seguimiento de tu compra' },
  { Icon: Headset, label: 'Atención en Uruguay' },
]

export default function Footer() {
  const { theme } = useTheme()
  const logo = theme === 'dark' ? '/logoDark.png' : '/logoLight.png'
  return (
    <footer className="border-t border-[var(--bd-1)] bg-[var(--bg-alt)]">
      {/* Trust strip */}
      <div className="border-b border-[var(--bd-1)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--sec)]/[0.10] border border-[var(--sec)]/20 shrink-0">
                <Icon size={16} className="text-[var(--sec)]" />
              </div>
              <span className="text-[12.5px] font-medium text-[var(--fg-2)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-2">
          <Link to="/" className="inline-flex items-center mb-4">
            <img src={logo} alt="Optimus Envíos" className="h-12 w-auto block" />
          </Link>
          <p className="text-[13px] text-[var(--fg-3)] leading-relaxed max-w-xs mb-5">
            Comprá en tiendas de Estados Unidos y mandá a tu familia en Cuba. Atención y cobro presencial en nuestra sucursal de Uruguay.
            Los más rápidos de Montevideo.
          </p>
          <div className="flex gap-2.5">
            <a href="mailto:[EMAIL]" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--bd-2)] text-[12px] text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:border-[var(--bd-3)] transition-colors">
              <Mail size={13} /> Email
            </a>
            <a href="https://wa.me/[WHATSAPP]" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#22C55E]/25 bg-[#22C55E]/[0.08] text-[12px] text-[#22C55E] hover:bg-[#22C55E]/[0.14] transition-colors">
              <MessageCircle size={13} /> WhatsApp
            </a>
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="font-display font-semibold text-[13px] text-[var(--fg-1)] mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-[13px] text-[var(--fg-3)] hover:text-[#E31E24] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--bd-1)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--fg-4)]">© 2026 Optimus Envíos · La logística, optimizada.</p>
          <p className="text-[11px] text-[var(--fg-5)]">Demo de validación · Datos simulados</p>
        </div>
      </div>
    </footer>
  )
}
