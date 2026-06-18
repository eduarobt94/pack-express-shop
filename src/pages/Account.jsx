import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, MapPin, CreditCard, Headset, LogOut,
  Plus, ChevronRight, Truck, CheckCircle2, Clock, MessageCircle, Mail, Star,
} from 'lucide-react'
import { currentUser, orders, addresses, paymentMethods, orderStatusMap } from '../data/account'
import { provincesCuba } from '../lib/shipping'
import { formatUSD, formatDate } from '../lib/format'
import ProductVisual from '../components/ui/ProductVisual'
import Button from '../components/ui/Button'

const TABS = [
  { id: 'dashboard', label: 'Resumen', Icon: LayoutDashboard },
  { id: 'orders', label: 'Mis pedidos', Icon: Package },
  { id: 'addresses', label: 'Destinatarios', Icon: MapPin },
  { id: 'payments', label: 'Pagos', Icon: CreditCard },
  { id: 'support', label: 'Soporte', Icon: Headset },
]

export default function Account() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="pt-0">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#F07232]/[0.12] border border-[#F07232]/25 flex items-center justify-center font-display font-extrabold text-xl text-[#F07232] shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div>
            <h1 className="font-display font-extrabold text-[clamp(1.4rem,3.5vw,2rem)] text-[var(--fg-1)]">Hola, {currentUser.name.split(' ')[0]}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E]/[0.10] border border-[#22C55E]/20 text-[11px] font-semibold text-[#22C55E]">
                <Star size={11} className="fill-current" /> {currentUser.tier}
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
                    tab === t.id ? 'bg-[#F07232]/[0.10] text-[#F07232]' : 'text-[var(--fg-2)] hover:bg-[var(--bd-1)]'
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
  const active = orders.filter((o) => o.status !== 'delivered').length
  const delivered = orders.filter((o) => o.status === 'delivered').length
  const spent = orders.reduce((s, o) => s + o.total, 0)
  const stats = [
    { Icon: Truck, label: 'Pedidos activos', value: active, accent: '#F07232' },
    { Icon: CheckCircle2, label: 'Entregados', value: delivered, accent: '#22C55E' },
    { Icon: CreditCard, label: 'Total invertido', value: formatUSD(spent), accent: '#527ED8' },
  ]
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.accent}1A`, border: `1px solid ${s.accent}33` }}>
              <s.Icon size={19} style={{ color: s.accent }} />
            </div>
            <div className="font-display font-extrabold text-2xl text-[var(--fg-1)]">{s.value}</div>
            <div className="text-[12.5px] text-[var(--fg-4)]">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-[16px] text-[var(--fg-1)]">Pedidos recientes</h2>
          <button onClick={() => setTab('orders')} className="text-[13px] font-medium text-[#527ED8] hover:text-[#6B90DC] cursor-pointer">Ver todos</button>
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
      <h2 className="font-display font-bold text-xl text-[var(--fg-1)] mb-5">Mis pedidos</h2>
      <div className="space-y-3">
        {orders.map((o) => <OrderCard key={o.id} order={o} />)}
      </div>
    </div>
  )
}

function OrderCard({ order }) {
  const status = orderStatusMap[order.status]
  const prov = provincesCuba.find((p) => p.code === order.province)
  const trackable = order.status === 'in_transit' || order.status === 'customs'
  return (
    <div className="card-surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--bd-1)]">
        <div>
          <span className="font-display font-bold text-[14.5px] text-[var(--fg-1)]">{order.id}</span>
          <span className="text-[12px] text-[var(--fg-4)] ml-2">{formatDate(order.date)}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold" style={{ background: `${status.color}1A`, color: status.color, border: `1px solid ${status.color}33` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} /> {status.label}
        </span>
      </div>

      <div className="flex items-center gap-3 py-4">
        <div className="flex -space-x-3">
          {order.items.map((it) => (
            <div key={it.id} className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[var(--bg-card)]">
              <ProductVisual icon={it.icon} tint={it.tint} size="sm" />
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium text-[var(--fg-1)] truncate">{order.items.map((i) => i.name).join(', ')}</div>
          <div className="text-[12px] text-[var(--fg-4)]">Para {order.recipient} · {prov?.name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display font-bold text-[15px] text-[var(--fg-1)]">{formatUSD(order.total)}</div>
          <div className="text-[11.5px] text-[var(--fg-4)]">{order.eta}</div>
        </div>
      </div>

      {trackable && (
        <Link to={`/seguimiento/${order.id}`} className="flex items-center justify-between mt-1 px-4 py-2.5 rounded-xl bg-[#F07232]/[0.08] border border-[#F07232]/20 text-[13px] font-semibold text-[#F07232] hover:bg-[#F07232]/[0.14] transition-colors">
          Ver seguimiento en tiempo real
          <ChevronRight size={16} />
        </Link>
      )}
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
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">CI</dt><dd className="text-[var(--fg-2)] tabular-nums">{a.ci}</dd></div>
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
  const labels = { visa: 'Visa', mastercard: 'Mastercard', paypal: 'PayPal' }
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-xl text-[var(--fg-1)]">Métodos de pago</h2>
        <Button variant="subtle" size="sm"><Plus size={15} /> Añadir</Button>
      </div>
      <div className="space-y-3">
        {paymentMethods.map((m) => (
          <div key={m.id} className="card-surface rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--bd-2)] flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-[#527ED8]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px] text-[var(--fg-1)]">
                {labels[m.type]} {m.last4 ? `•••• ${m.last4}` : m.email}
              </div>
              {m.exp && <div className="text-[12px] text-[var(--fg-4)]">Vence {m.exp}</div>}
            </div>
            {m.isDefault && <span className="px-2.5 py-1 rounded-full bg-[#22C55E]/[0.10] text-[11px] font-semibold text-[#22C55E] border border-[#22C55E]/20">Predeterminado</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Support() {
  const channels = [
    { Icon: MessageCircle, accent: '#22C55E', title: 'WhatsApp', desc: 'Respuesta en minutos, horario extendido', action: 'Chatear ahora' },
    { Icon: Mail, accent: '#527ED8', title: 'Email', desc: 'hola@packexpress.shop · respuesta en 4h', action: 'Escribir email' },
    { Icon: Headset, accent: '#F07232', title: 'Centro de ayuda', desc: 'Preguntas frecuentes sobre envíos a Cuba', action: 'Ver artículos' },
  ]
  return (
    <div>
      <h2 className="font-display font-bold text-xl text-[var(--fg-1)] mb-1.5">¿Cómo podemos ayudarte?</h2>
      <p className="text-[13.5px] text-[var(--fg-3)] mb-6">Nuestro equipo conoce el envío a Cuba y responde rápido.</p>
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
