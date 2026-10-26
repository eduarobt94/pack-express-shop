import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Truck, Copy, Check, MapPin, Package, PackagePlus, PackageCheck, AlertCircle, AlertTriangle } from 'lucide-react'
import { currentSuite, lockerPackages, lockerShipments } from '../data/locker'
import { PACKAGE_STATES, CONSOLIDABLE_STATES } from '../lib/locker'
import { formatUSD, formatDate } from '../lib/format'
import { currentUser } from '../data/account'
import PackageCard from '../components/locker/PackageCard'
import PurchaseForm from '../components/locker/PurchaseForm'
import PurchaseList from '../components/locker/PurchaseList'
import { api } from '../lib/api'
import ConsolidateDrawer from '../components/locker/ConsolidateDrawer'
import Button from '../components/ui/Button'
import { PageHeader } from '../components/ui/Layout'
import LoginModal from '../components/auth/LoginModal'
import { useAuth } from '../context/AuthContext'


import { readable } from '../lib/contrast'
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
  const { isAuthenticated } = useAuth()
  const [loginOpen] = useState(!isAuthenticated)
  const [tab, setTab] = useState('packages')
  const [copied, setCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [purchases, setPurchases] = useState(null)
  const [purchasesError, setPurchasesError] = useState('')

  const loadPurchases = useCallback(async () => {
    try {
      const res = await api.get('/purchases')
      setPurchases(res.data)
      setPurchasesError('')
    } catch (err) {
      setPurchasesError(err.message)
    }
  }, [])

  useEffect(() => {
    // Carga de datos desde la API al ingresar (sincroniza con un sistema externo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) loadPurchases()
  }, [isAuthenticated, loadPurchases])

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

  // Guest gate: modal + blurred background
  if (!isAuthenticated) {
    return (
      <>
        <div className="select-none pointer-events-none blur-sm opacity-40 min-h-[60vh]" aria-hidden="true">
          <PageHeader eyebrow="Recepción" title="Mis compras y recepción">
            <p className="mt-6 text-[13px] text-[var(--fg-3)]">Suite OPT-UY-XXXXXX</p>
          </PageHeader>
          <div className="container-x"><div className="h-40 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-alt)]" /></div>
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
    <PageHeader eyebrow="Recepción" title="Mis compras y recepción">
      <p className="mt-6 text-[13px] text-[var(--fg-3)]">Hola, {currentUser.name.split(' ')[0]} — Código <span className="font-mono font-medium text-[var(--fg-1)]">{currentSuite.suiteId}</span></p>
    </PageHeader>
    <div className="container-x pb-24 md:pb-32 max-w-5xl">

      {/* Dirección Miami */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border border-[var(--bd-2)] bg-[var(--bg-alt)] p-6 sm:p-8 mb-12"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-[var(--brand-text)]" />
              <span className="text-[12px] font-bold text-[var(--brand-text)] uppercase tracking-wide">Tu dirección de recepción en EE.UU.</span>
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
            className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-[13px] font-semibold transition-colors duration-300 cursor-pointer ${
              copied
                ? 'border-[#22C55E] bg-[#22C55E]/[0.10] text-[var(--ok-text)]'
                : 'border-[var(--bd-2)] text-[var(--fg-2)] hover:border-[var(--bd-3)]'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar dirección'}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-[#E31E24]/[0.06] border border-[#E31E24]/15">
          <AlertCircle size={14} className="text-[var(--brand-text)] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--fg-2)]">
            Siempre incluye tu suite <strong>{currentSuite.suiteId}</strong> como nombre o número de apartamento al hacer una compra. Luego registrá la compra en "Compras registradas".
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Listos para despacho', value: readyCount, color: '#22C55E', Icon: PackagePlus },
          { label: 'En proceso', value: pendingCount, color: '#F5A524', Icon: PackageCheck },
          { label: 'Compras por recibir', value: (purchases ?? []).filter((p) => ['registered', 'in_review', 'accepted', 'partially_received'].includes(p.status)).length, color: '#A8A8A8', Icon: Bell },
          { label: 'Incidencias', value: retainedCount, color: '#EF4444', Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-[var(--bd-2)] p-5"
          >
            <Icon size={18} strokeWidth={1.5} className="mb-4" style={{ color: readable(color) }} />
            <p className="text-[1.75rem] font-display font-extrabold tracking-[-0.02em] tabular-nums text-[var(--fg-1)]">{value}</p>
            <p className="text-[12px] text-[var(--fg-3)] mt-1 leading-tight">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-x-8 mb-10 overflow-x-auto scrollbar-hide border-b border-[var(--bd-2)]">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex items-center gap-2 py-3.5 text-[14px] whitespace-nowrap border-b-2 -mb-px transition-colors duration-300 cursor-pointer ${
              tab === id ? 'border-[var(--brand-text)] text-[var(--brand-text)] font-semibold' : 'border-transparent text-[var(--fg-3)] hover:text-[var(--fg-1)]'
            }`}
          >
            <Icon size={16} strokeWidth={1.5} /> {label}
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
                  <p className="text-[13px] text-[var(--fg-3)]">Elegí los paquetes <span className="text-[var(--ok-text)] font-semibold">listos</span> que querés enviar juntos</p>
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

          {/* ── Compras registradas ── */}
          {tab === 'prealerts' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-start">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--fg-1)] mb-4">Compras registradas</h2>
                <PurchaseList purchases={purchases} error={purchasesError} onChanged={loadPurchases} />
              </div>
              <div className="rounded-xl border border-[var(--bd-2)] p-5 sm:p-6">
                <h2 className="text-[14px] font-bold text-[var(--fg-1)] mb-5">Registrar una compra</h2>
                <PurchaseForm onCreated={loadPurchases} />
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
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold mb-1.5" style={{ background: `${meta.color}18`, color: readable(meta.color) }}>
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
