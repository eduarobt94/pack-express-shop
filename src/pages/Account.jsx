import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, MapPin, CreditCard, Headset, LogOut,
  Plus, ChevronRight, Truck, CheckCircle2, Clock, MessageCircle, Mail, } from 'lucide-react'
import { currentUser, orders, addresses, shipStatusMap, payStatusMap } from '../data/account'
import { provincesCuba } from '../lib/shipping'
import { formatUSD, formatDate } from '../lib/format'
import ProductVisual from '../components/ui/ProductVisual'
import Button from '../components/ui/Button'

const TABS = [
  { id: 'dashboard', label: 'Resumen', Icon: LayoutDashboard },
  { id: 'orders', label: 'Mis compras', Icon: Package },
  { id: 'addresses', label: 'Destinatarios', Icon: MapPin },
  { id: 'payments', label: 'Liquidaciones y pagos', Icon: CreditCard },
  { id: 'support', label: 'Soporte', Icon: Headset },
]

export default function Account() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="pt-0">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#E31E24]/[0.12] border border-[#E31E24]/25 flex items-center justify-center font-display font-extrabold text-xl text-[#E31E24] shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div>
            <h1 className="font-display font-extrabold text-[clamp(1.4rem,3.5vw,2rem)] text-[var(--fg-1)]">Hola, {currentUser.name.split(' ')[0]}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bd-1)] border border-[var(--bd-2)] text-[11px] font-bold text-[var(--fg-1)] font-mono">
                Código {currentUser.code}
              </span>
              <span className="text-[12.5px] text-[var(--fg-4)]">Cliente desde {formatDate(currentUser.since)}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
          {/* Sidebar nav */}
          <aside className="lg:sticky lg:top-24">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide pb-2 lg:pb-0">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    tab === t.id ? 'bg-[#E31E24]/[0.10] text-[#E31E24]' : 'text-[var(--fg-2)] hover:bg-[var(--bd-1)]'
                  }`}
                >
                  <t.Icon size={17} /> {t.label}
                </button>
              ))}
              <button className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium text-[var(--fg-3)] hover:bg-[var(--bd-1)] transition-colors cursor-pointer mt-2">
                <LogOut size={17} /> Cerrar sesión
              </button>
            </nav>
          </aside>

          {/* Content */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                {tab === 'dashboard' && <Dashboard setTab={setTab} />}
                {tab === 'orders' && <Orders />}
                {tab === 'addresses' && <Addresses />}
                {tab === 'payments' && <Payments />}
                {tab === 'support' && <Support />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ setTab }) {
  const active = orders.filter((o) => o.shipStatus !== 'delivered').length
  const delivered = orders.filter((o) => o.shipStatus === 'delivered').length
  const toPay = orders.filter((o) => o.payStatus !== 'paid').reduce((s, o) => s + o.optimusTotal, 0)
  const stats = [
    { Icon: Truck, label: 'Compras activas', value: active, accent: '#E31E24' },
    { Icon: CheckCircle2, label: 'Entregadas', value: delivered, accent: '#22C55E' },
    { Icon: CreditCard, label: 'Pendiente de pago en sucursal', value: formatUSD(toPay), accent: '#A8A8A8' },
  ]
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface rounded-xl p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.accent}1A`, border: `1px solid ${s.accent}33` }}>
              <s.Icon size={19} style={{ color: s.accent }} />
            </div>
            <div className="font-display font-black text-2xl text-[var(--fg-1)]">{s.value}</div>
            <div className="text-[12.5px] text-[var(--fg-4)]">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-[16px] text-[var(--fg-1)]">Compras recientes</h2>
          <button onClick={() => setTab('orders')} className="text-[13px] font-medium text-[var(--sec)] hover:text-[var(--sec-hover)] cursor-pointer">Ver todas</button>
        </div>
        <div className="space-y-3">
          {orders.slice(0, 2).map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      </div>
    </div>
  )
}

function Orders() {
  return (
    <div>
      <h2 className="font-display font-extrabold text-xl text-[var(--fg-1)] mb-5">Mis compras</h2>
      <div className="space-y-3">
        {orders.map((o) => <OrderCard key={o.id} order={o} />)}
      </div>
    </div>
  )
}

function Badge({ meta }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold" style={{ background: `${meta.color}1A`, color: meta.color, border: `1px solid ${meta.color}33` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} /> {meta.label}
    </span>
  )
}

function OrderCard({ order }) {
  const ship = shipStatusMap[order.shipStatus]
  const pay = payStatusMap[order.payStatus]
  const prov = provincesCuba.find((p) => p.code === order.province)
  return (
    <div className="card-surface rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--bd-1)]">
        <div>
          <span className="font-display font-extrabold text-[14.5px] text-[var(--fg-1)]">{order.id}</span>
          <span className="text-[12px] text-[var(--fg-4)] ml-2">{formatDate(order.date)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge meta={ship} />
          <Badge meta={pay} />
        </div>
      </div>

      <div className="flex items-center gap-4 py-4">
        <div className="flex -space-x-2 shrink-0">
          {order.items.map((it) => (
            <div key={it.id} className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[var(--bg-card)]">
              <ProductVisual icon={it.icon} tint={it.tint} size="sm" />
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-[var(--fg-1)] truncate">{order.items.map((i) => i.name).join(', ')}</div>
          <div className="text-[12px] text-[var(--fg-4)]">{order.store} · pedido {order.storeOrder}</div>
          <div className="text-[12px] text-[var(--fg-4)]">Para {order.recipient} · {prov?.name}</div>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-t border-[var(--bd-1)] text-[12.5px]">
        <div><dt className="text-[var(--fg-4)]">Producto (tienda)</dt><dd className="font-semibold text-[var(--fg-2)] tabular-nums">{formatUSD(order.productValue)}</dd></div>
        <div><dt className="text-[var(--fg-4)]">Comisión</dt><dd className="font-semibold text-[var(--fg-2)] tabular-nums">{formatUSD(order.commission)}</dd></div>
        <div><dt className="text-[var(--fg-4)]">Envío ({order.weightKg} kg)</dt><dd className="font-semibold text-[var(--fg-2)] tabular-nums">{formatUSD(order.shipping)}</dd></div>
        <div><dt className="text-[var(--fg-4)]">Pagás a Optimus</dt><dd className="font-display font-black text-[#E31E24] tabular-nums">{formatUSD(order.optimusTotal)}</dd></div>
      </dl>

      <Link to={`/seguimiento/${order.id}`} className="flex items-center justify-between mt-1 px-4 py-2.5 rounded-lg bg-[#E31E24]/[0.08] border border-[#E31E24]/20 text-[13px] font-semibold text-[#E31E24] hover:bg-[#E31E24]/[0.14] transition-colors">
        Ver seguimiento
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}

function Addresses() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-xl text-[var(--fg-1)]">Destinatarios en Cuba</h2>
        <Button variant="subtle" size="sm"><Plus size={15} /> Añadir</Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {addresses.map((a) => {
          const prov = provincesCuba.find((p) => p.code === a.province)
          return (
            <div key={a.id} className="card-surface rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-semibold text-[14.5px] text-[var(--fg-1)]">{a.label}</span>
                {a.isDefault && <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/[0.10] text-[10.5px] font-semibold text-[#22C55E] border border-[#22C55E]/20">Predeterminado</span>}
              </div>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Recibe</dt><dd className="text-[var(--fg-2)]">{a.recipient}</dd></div>
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Teléfono</dt><dd className="text-[var(--fg-2)]">{a.phone}</dd></div>
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Dirección</dt><dd className="text-[var(--fg-2)]">{a.street}, {a.municipality}, {prov?.name}</dd></div>
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Payments() {
  return (
    <div>
      <h2 className="font-display font-extrabold text-xl text-[var(--fg-1)] mb-2">Liquidaciones y pagos</h2>
      <p className="text-[13.5px] text-[var(--fg-3)] mb-6">Los pagos a Optimus se hacen en la sucursal. Un empleado registra y valida el cobro: desde la web no se puede confirmar un pago.</p>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="card-surface rounded-xl p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[180px]">
              <div className="font-display font-extrabold text-[14px] text-[var(--fg-1)]">{o.id}</div>
              <div className="text-[12px] text-[var(--fg-4)]">Tarifa aplicada: {o.rateSnapshot.commissionRate * 100}% + {formatUSD(o.rateSnapshot.sellRatePerKg)}/kg</div>
            </div>
            <Badge meta={payStatusMap[o.payStatus]} />
            <div className="font-display font-black text-[16px] text-[var(--fg-1)] tabular-nums">{formatUSD(o.optimusTotal)}</div>
            <Button variant="subtle" size="sm">Constancia</Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Support() {
  const channels = [
    { Icon: MessageCircle, accent: '#22C55E', title: 'WhatsApp', desc: 'Respuesta en minutos, horario extendido', action: 'Chatear ahora' },
    { Icon: Mail, accent: '#A8A8A8', title: 'Email', desc: '[EMAIL] · respuesta en 4h', action: 'Escribir email' },
    { Icon: Headset, accent: '#E31E24', title: 'Centro de ayuda', desc: 'Preguntas frecuentes sobre el servicio', action: 'Ver preguntas' },
  ]
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-[var(--fg-1)] mb-1.5">¿Cómo podemos ayudarte?</h2>
      <p className="text-[13.5px] text-[var(--fg-3)] mb-6">Respondemos en minutos, no en días.</p>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {channels.map((c) => (
          <div key={c.title} className="card-surface rounded-2xl p-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${c.accent}1A`, border: `1px solid ${c.accent}33` }}>
              <c.Icon size={20} style={{ color: c.accent }} />
            </div>
            <h3 className="font-display font-semibold text-[15px] text-[var(--fg-1)] mb-1">{c.title}</h3>
            <p className="text-[12.5px] text-[var(--fg-3)] mb-4 leading-relaxed">{c.desc}</p>
            <button className="text-[13px] font-semibold cursor-pointer" style={{ color: c.accent }}>{c.action} →</button>
          </div>
        ))}
      </div>
      <div className="card-surface rounded-2xl p-5 flex items-center gap-3">
        <Clock size={18} className="text-[#22C55E] shrink-0" />
        <p className="text-[13px] text-[var(--fg-2)]">Tiempo de respuesta promedio: <span className="font-semibold text-[var(--fg-1)]">menos de 4 horas hábiles</span>.</p>
      </div>
    </div>
  )
}
