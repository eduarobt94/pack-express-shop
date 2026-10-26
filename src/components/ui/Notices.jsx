import { Link } from 'react-router-dom'
import { Info, MapPin } from 'lucide-react'

/** Aviso de precios de terceros (obligatorio junto a cualquier precio de tienda). */
export function PriceNotice({ className = '' }) {
  return (
    <p className={`flex items-start gap-1.5 text-[11.5px] text-[var(--fg-4)] leading-relaxed ${className}`}>
      <Info size={13} className="shrink-0 mt-0.5" />
      Precio y disponibilidad pertenecen a la tienda y pueden cambiar. Comisión y envío se calculan por separado.
    </p>
  )
}

/** Recordatorio de recepción antes de salir a la tienda externa. */
export function ReceptionReminder() {
  return (
    <div className="flex items-start gap-3 p-4 mb-4 rounded-xl border-[1.5px] border-[var(--bd-3)] bg-[var(--bg-elevated)]">
      <MapPin size={18} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
      <p className="text-[12.5px] text-[var(--fg-2)] leading-relaxed">
        Al comprar, usá tu <span className="font-bold text-[var(--fg-1)]">dirección y código de recepción</span> de Optimus y después{' '}
        <Link to="/casillero" className="font-bold text-[var(--brand-text)]">registrá la compra</Link>. Es obligatorio: la tienda no nos avisa qué compraste.
      </p>
    </div>
  )
}
