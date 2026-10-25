import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, UserPlus, Store, FileText, PackageCheck, Wallet, Plane, MapPin } from 'lucide-react'
import Button from '../components/ui/Button'

const STEPS = [
  { Icon: Search, title: 'Mirá cómo funciona', desc: 'Consultá cargos y restricciones antes de comprar.' },
  { Icon: UserPlus, title: 'Registrate', desc: 'Obtenés tu código personal y la dirección autorizada de recepción en EE.UU.' },
  { Icon: Store, title: 'Comprá en la tienda', desc: 'Entrás desde Optimus, elegís y pagás el producto con tus propios medios.' },
  { Icon: FileText, title: 'Registrá la compra', desc: 'Cargás comprobante, productos, seguimiento y destinatario en Cuba. Es obligatorio.' },
  { Icon: PackageCheck, title: 'Recibimos y pesamos', desc: 'Nuestro colaborador en EE.UU. confirma la recepción, pesa y carga fotos.' },
  { Icon: Wallet, title: 'Pagás en la sucursal', desc: 'Emitimos la liquidación final. Un empleado registra y valida tu pago.' },
  { Icon: Plane, title: 'Despachamos', desc: 'Con el pago completo se despacha. Seguís el envío desde tu cuenta.' },
  { Icon: MapPin, title: 'Entrega en Cuba', desc: 'Tu familiar recibe y paga la aduana en ese momento.' },
]

const WHO = [
  { who: 'A la tienda', what: 'El producto', note: 'Con tus tarjetas o medios de pago. Nunca te los pedimos.' },
  { who: 'A Optimus (sucursal en Uruguay)', what: 'Comisión de gestión + envío por kilo', note: 'Ver tarifas y calculadora.' },
  { who: 'En Cuba (quien recibe)', what: 'La aduana', note: 'No está incluida en lo que pagás a Optimus.' },
]

export default function HowToBuy() {
  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
      <h1 className="font-display font-black text-[clamp(1.75rem,4vw,3rem)] text-[var(--fg-1)] leading-tight mb-2">Cómo comprar</h1>
      <p className="font-display italic font-light text-[18px] text-[var(--fg-3)] mb-10">Ocho pasos, cero vueltas.</p>

      <ol className="grid sm:grid-cols-2 gap-4 mb-14">
        {STEPS.map(({ Icon, title, desc }, i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.2) }}
            className="card-surface rounded-xl p-5 flex gap-4"
          >
            <div className="w-11 h-11 rounded-lg bg-[#E31E24]/[0.10] border border-[#E31E24]/25 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-[#E31E24]" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-[15px] text-[var(--fg-1)]"><span className="text-[#E31E24] mr-1.5">{i + 1}.</span>{title}</h2>
              <p className="text-[13px] text-[var(--fg-3)] mt-1 leading-relaxed">{desc}</p>
            </div>
          </motion.li>
        ))}
      </ol>

      <h2 className="font-display font-extrabold text-2xl text-[var(--fg-1)] mb-4">Qué pagás y a quién</h2>
      <div className="grid md:grid-cols-3 gap-4 mb-14">
        {WHO.map((w) => (
          <div key={w.who} className="card-surface rounded-xl p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-4)] mb-2">{w.who}</div>
            <div className="font-display font-extrabold text-[16px] text-[var(--fg-1)] mb-1">{w.what}</div>
            <p className="text-[12.5px] text-[var(--fg-3)] leading-relaxed">{w.note}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display font-extrabold text-2xl text-[var(--fg-1)] mb-4">Tu dirección de recepción</h2>
      <div className="card-surface rounded-xl p-5 mb-10 text-[14px] text-[var(--fg-2)] leading-relaxed">
        <p className="mb-3">
          Al registrarte te asignamos un código personal con este formato:{' '}
          <span className="font-mono font-bold text-[var(--fg-1)]">OPT-UY-######</span>. Usalo en el nombre o suite de la dirección de envío de la tienda.
        </p>
        <p className="font-mono text-[13px] text-[var(--fg-3)]">[DIRECCIÓN DE RECEPCIÓN EN EE.UU. — pendiente de confirmar por Optimus]</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => window.dispatchEvent(new Event('open-login'))} size="lg">Registrarme</Button>
        <Button to="/tarifas" variant="outline" size="lg">Ver tarifas</Button>
        <Link to="/catalogo" className="self-center text-[13px] font-bold text-[#E31E24]">Ver tiendas</Link>
      </div>
    </div>
  )
}
