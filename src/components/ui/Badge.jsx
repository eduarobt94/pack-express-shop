const VARIANTS = {
  'Más vendido': { bg: 'rgba(240,114,50,0.12)', fg: '#F07232', bd: 'rgba(240,114,50,0.30)' },
  Nuevo: { bg: 'rgba(82,126,216,0.12)', fg: '#527ED8', bd: 'rgba(82,126,216,0.30)' },
  Oferta: { bg: 'rgba(240,114,50,0.12)', fg: '#F07232', bd: 'rgba(240,114,50,0.30)' },
  'Stock limitado': { bg: 'rgba(240,114,50,0.12)', fg: '#F07232', bd: 'rgba(240,114,50,0.30)' },
  Agotado: { bg: 'rgba(239,68,68,0.12)', fg: '#EF4444', bd: 'rgba(239,68,68,0.30)' },
}

export default function Badge({ children, color }) {
  const v = VARIANTS[children] || { bg: color ? `${color}20` : 'var(--bd-1)', fg: color || 'var(--fg-2)', bd: color ? `${color}40` : 'var(--bd-2)' }
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-wider whitespace-nowrap"
      style={{ background: v.bg, color: v.fg, border: `1px solid ${v.bd}` }}
    >
      {children}
    </span>
  )
}
