import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Warehouse, Bell, Truck, Copy, Check, MapPin, Package, PackagePlus, PackageCheck, AlertCircle, AlertTriangle } from 'lucide-react'
import { currentSuite, lockerPackages, preAlerts, lockerShipments } from '../data/locker'
import { PACKAGE_STATES, CONSOLIDABLE_STATES } from '../lib/locker'
import { formatUSD, formatDate, formatDateTime } from '../lib/format'
import { currentUser } from '../data/account'
import PackageCard from '../components/locker/PackageCard'
import PreAlertForm from '../components/locker/PreAlertForm'
import ConsolidateDrawer from '../components/locker/ConsolidateDrawer'
import Button from '../components/ui/Button'
import LoginModal from '../components/auth/LoginModal'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'packages', label: 'Paquetes', Icon: Package },
  { id: 'retained', label: 'Incidencias', Icon: AlertTriangle },
  { id: 'prealerts', label: 'Compras registradas', Icon: Bell },
  { id: 'shipments', label: 'Envíos', Icon: Truck },
]

const SHIPMENT_STATUS = {
  pending_payment: { label: 'Pendiente de pago en sucursal', color: '#F5A524' },
  paid: { label: 'Pagado', color: '#A8A8A8' },
  in_transit: { label: 'En tránsito', color: '#E31E24' },
  delivered: { label: 'Entregado', color: '#22C55E' },
}

export default function Locker() {
  const { isAuthenticated, user } = useAuth()
  const [loginOpen, setLoginOpen] = useState(!isAuthenticated)
  const [tab, setTab] = useState('packages')
  const [copied, setCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [alerts, setAlerts] = useState(preAlerts)

  const readyCount = lockerPackages.filter((p) => p.status === 'ready').length
  const pendingCount = lockerPackages.filter((p) => p.status === 'no_docs' || p.status === 'verifying').length
  const retainedCount = lockerPackages.filter((p) => p.status === 'retained').length
  const retainedPackages = lockerPackages.filter((p) => p.status === 'retained')
  const selectedPackages = lockerPackages.filter((p) => selectedIds.includes(p.id))

  function copyAddress() {
    const full = `${currentSuite.address.street}, Suite ${currentSuite.suiteId}, ${currentSuite.address.city}, ${currentSuite.address.state} ${currentSuite.address.zip}, EE.UU.`
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  function handleShipmentConfirm() {
    setDrawerOpen(false)
    setSelectedIds([])
  }

  function handlePreAlertSave(data) {
    setAlerts((prev) => [
      {
        id: `PA-2026-${String(Date.now()).slice(-5)}`,
        suiteId: currentSuite.suiteId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...data,
      },
      ...prev,
    ])
  }

  // Guest gate: modal + blurred background
  if (!isAuthenticated) {
    return (
      <>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 select-none pointer-events-none blur-sm opacity-40 min-h-[60vh]">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--sec)]/[0.12] border border-[var(--sec)]/25 flex items-center justify-center shrink-0">
              <Warehouse size={24} className="text-[var(--sec)]" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-[clamp(1.35rem,3.5vw,2rem)] text-[var(--fg-1)]">Mis compras y recepción</h1>
              <p className="text-[13px] text-[var(--fg-3)] mt-0.5">Suite OPT-UY-XXXXXX</p>
            </div>
          </div>
          <div className="h-40 rounded-2xl border border-[var(--bd-2)] bg-[var(--bg-card)]" />
        </div>
        <LoginModal
          open={loginOpen}
          onClose={() => {}}
          closeable={false}
        />
      </>
    )
  }

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[var(--sec)]/[0.12] border border-[var(--sec)]/25 flex items-center justify-center shrink-0">
          <Warehouse size={24} className="text-[var(--sec)]" />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-[clamp(1.35rem,3.5vw,2rem)] text-[var(--fg-1)]">Mis compras y recepción</h1>
          <p className="text-[13px] text-[var(--fg-3)] mt-0.5">Hola, {currentUser.name.split(' ')[0]} — Código <span className="font-mono font-semibold text-[var(--fg-1)]">{currentSuite.suiteId}</span></p>
        </div>
      </div>

      {/* Dirección Miami */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-[var(--bd-2)] bg-[var(--bg-card)] p-5 mb-8"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-[#E31E24]" />
              <span className="text-[12px] font-bold text-[#E31E24] uppercase tracking-wide">Tu dirección de recepción en EE.UU.</span>
            </div>
            <div className="space-y-1 text-[14px] text-[var(--fg-1)]">
              <p className="font-semibold">{currentSuite.address.street}</p>
              <p className="font-mono text-[var(--sec)] font-bold">Código de recepción: {currentSuite.suiteId}</p>
              <p>{currentSuite.address.city}, {currentSuite.address.state} {currentSuite.address.zip}, EE.UU.</p>
              <p className="text-[var(--fg-3)] text-[13px]">Tel: {currentSuite.address.phone}</p>
            </div>
          </div>
          <button
            onClick={copyAddress}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-all cursor-pointer ${
              copied
                ? 'border-[#22C55E] bg-[#22C55E]/[0.10] text-[#22C55E]'
                : 'border-[var(--bd-2)] text-[var(--fg-2)] hover:border-[var(--bd-3)]'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar dirección'}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-[#E31E24]/[0.06] border border-[#E31E24]/15">
          <AlertCircle size={14} className="text-[#E31E24] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--fg-2)]">
            Siempre incluye tu suite <strong>{currentSuite.suiteId}</strong> como nombre o número de apartamento al hacer una compra. Luego regístrala como pre-alerta.
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Listos para despacho', value: readyCount, color: '#22C55E', Icon: PackagePlus },
          { label: 'En proceso', value: pendingCount, color: '#F5A524', Icon: PackageCheck },
          { label: 'Compras por recibir', value: alerts.filter((a) => a.status === 'pending').length, color: '#A8A8A8', Icon: Bell },
          { label: 'Incidencias', value: retainedCount, color: '#EF4444', Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-[var(--bd-2)] bg-[var(--bg-card)] p-4 text-center"
          >
            <Icon size={20} className="mx-auto mb-2" style={{ color }} />
            <p className="text-[22px] font-display font-extrabold" style={{ color }}>{value}</p>
            <p className="text-[11px] text-[var(--fg-3)] mt-0.5 leading-tight">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13.5px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
              tab === id ? 'bg-[#E31E24]/[0.10] text-[#E31E24]' : 'text-[var(--fg-2)] hover:bg-[var(--bd-1)]'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {/* ── Paquetes ── */}
          {tab === 'packages' && (
            <div>
              {selectedIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 mb-5 p-4 rounded-2xl bg-[#E31E24]/[0.08] border border-[#E31E24]/20"
                >
                  <p className="text-[13.5px] font-semibold text-[var(--fg-1)]">
                    {selectedIds.length} paquete{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedIds([])} className="text-[12.5px] text-[var(--fg-3)] hover:text-[var(--fg-1)] transition-colors cursor-pointer px-3 py-1.5">
                      Cancelar
                    </button>
                    <Button size="sm" onClick={() => setDrawerOpen(true)}>
                      Solicitar liquidación
                    </Button>
                  </div>
                </motion.div>
              )}

              {readyCount > 0 && selectedIds.length === 0 && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] text-[var(--fg-3)]">Elegí los paquetes <span className="text-[#22C55E] font-semibold">listos</span> que querés enviar juntos</p>
                </div>
              )}

              <div className="space-y-3">
                {lockerPackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    selectable
                    selected={selectedIds.includes(pkg.id)}
                    onSelect={toggleSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Retenidos ── */}
          {tab === 'retained' && (
            <div>
              <h2 className="text-[14px] font-bold text-[var(--fg-1)] mb-4">Incidencias</h2>
              {retainedPackages.length === 0 ? (
                <Empty icon={AlertTriangle} text="No tenés incidencias." />
              ) : (
                <div className="space-y-3">
                  {retainedPackages.map((pkg) => (
                    <PackageCard key={pkg.id} pkg={pkg} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Pre-alertas ── */}
          {tab === 'prealerts' && (
            <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
              {/* Lista */}
              <div>
                <h2 className="text-[14px] font-bold text-[var(--fg-1)] mb-4">Compras registradas</h2>
                {alerts.length === 0 ? (
                  <Empty icon={Bell} text="Aún no tienes pre-alertas. Regístralas cada vez que hagas una compra." />
                ) : (
                  <div className="space-y-3">
                    {alerts.map((a) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-[var(--bd-2)] bg-[var(--bg-card)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1.5 ${
                              a.status === 'matched'
                                ? 'bg-[#22C55E]/[0.10] text-[#22C55E]'
                                : 'bg-[var(--sec)]/[0.10] text-[var(--sec)]'
                            }`}>
                              {a.status === 'matched' ? 'Recibido' : 'En camino'}
                            </span>
                            <p className="text-[14px] font-semibold text-[var(--fg-1)]">{a.description}</p>
                            <p className="text-[12.5px] text-[var(--fg-3)] mt-0.5">{a.store} · {a.pieces} pieza{a.pieces !== 1 ? 's' : ''} · {formatUSD(a.declaredValue)}</p>
                            <p className="font-mono text-[12px] text-[var(--fg-4)] mt-1">{a.trackingNumber}</p>
                          </div>
                          <span className="text-[11.5px] text-[var(--fg-4)] whitespace-nowrap">{formatDate(a.createdAt)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulario */}
              <div className="rounded-2xl border border-[var(--bd-2)] bg-[var(--bg-card)] p-5">
                <h2 className="text-[14px] font-bold text-[var(--fg-1)] mb-4">Registrar una compra</h2>
                <PreAlertForm onSave={handlePreAlertSave} />
              </div>
            </div>
          )}

          {/* ── Envíos ── */}
          {tab === 'shipments' && (
            <div>
              <h2 className="text-[14px] font-bold text-[var(--fg-1)] mb-4">Envíos y liquidaciones</h2>
              {lockerShipments.length === 0 ? (
                <Empty icon={Truck} text="Todavía no solicitaste ningún envío." />
              ) : (
                <div className="space-y-4">
                  {lockerShipments.map((sh) => {
                    const meta = SHIPMENT_STATUS[sh.status]
                    return (
                      <motion.div
                        key={sh.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-[var(--bd-2)] bg-[var(--bg-card)] p-5"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-1.5" style={{ background: `${meta.color}18`, color: meta.color }}>
                              {meta.label}
                            </span>
                            <p className="text-[14px] font-bold text-[var(--fg-1)] font-mono">{sh.id}</p>
                            <p className="text-[12.5px] text-[var(--fg-3)]">{sh.packageIds.length} paquete{sh.packageIds.length !== 1 ? 's' : ''} · Creado {formatDate(sh.createdAt)}</p>
                          </div>
                          <p className="text-[20px] font-display font-extrabold text-[var(--fg-1)]">{formatUSD(sh.total)}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--bd-1)] text-center">
                          <Stat label="Peso" value={`${sh.totalWeightKg} kg`} />
                          <Stat label="Comisión" value={formatUSD(sh.commission)} />
                          <Stat label="Envío" value={formatUSD(sh.freight)} />
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Drawer de consolidación */}
      <ConsolidateDrawer
        open={drawerOpen}
        packages={selectedPackages}
        onClose={() => setDrawerOpen(false)}
        onConfirm={handleShipmentConfirm}
      />
    </div>
    </>
  )
}

function Empty({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--bd-1)] flex items-center justify-center">
        <Icon size={24} className="text-[var(--fg-4)]" />
      </div>
      <p className="text-[13.5px] text-[var(--fg-3)] max-w-xs">{text}</p>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--fg-4)] uppercase tracking-wide">{label}</p>
      <p className="text-[14px] font-semibold text-[var(--fg-2)] mt-0.5">{value}</p>
    </div>
  )
}
