import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Store, FileText, DollarSign, Package, Hash, CheckCircle2, Truck, Upload, MessageSquare } from 'lucide-react'
import Button from '../ui/Button'

const STORES = ['Amazon', 'Walmart', 'Best Buy', 'eBay', 'Home Depot', 'Temu', 'Target', 'Costco', 'Newegg', 'AliExpress USA', 'Otra tienda']
const CARRIERS = ['DHL', 'FedEx Express', 'FedEx Ground', 'UPS', 'USPS', 'Amazon Logistics', 'Otros']

const empty = { store: '', description: '', declaredValue: '', trackingNumber: '', pieces: '1', carrier: '', instructions: '' }

export default function PreAlertForm({ onSave }) {
  const [form, setForm] = useState(empty)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState({})
  const [facturaName, setFacturaName] = useState(null)

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.store) e.store = 'Selecciona la tienda'
    if (!form.description.trim()) e.description = 'Describe el producto'
    if (!form.declaredValue || Number(form.declaredValue) <= 0) e.declaredValue = 'Ingresa el valor'
    if (!form.trackingNumber.trim()) e.trackingNumber = 'Ingresa el número de seguimiento'
    if (!form.carrier) e.carrier = 'Selecciona el transportista'
    if (!facturaName) e.factura = 'La factura es obligatoria'
    return e
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    onSave?.({
      store: form.store,
      description: form.description.trim(),
      declaredValue: Number(form.declaredValue),
      trackingNumber: form.trackingNumber.trim(),
      pieces: Math.max(1, Number(form.pieces) || 1),
      carrier: form.carrier,
      instructions: form.instructions.trim() || null,
    })
    setSaved(true)
    setTimeout(() => { setSaved(false); setForm(empty); setFacturaName(null) }, 3000)
  }

  if (saved) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-3 py-16 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-[#22C55E]/[0.12] flex items-center justify-center">
          <CheckCircle2 size={28} className="text-[#22C55E]" />
        </div>
        <p className="text-[15px] font-semibold text-[var(--fg-1)]">¡Pre-alerta registrada!</p>
        <p className="text-[13px] text-[var(--fg-3)]">Te notificaremos cuando llegue a Miami.</p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Bell size={18} className="text-[#E31E24]" />
        <p className="text-[13.5px] text-[var(--fg-2)]">
          Avísanos qué compraste para agilizar la recepción y el despacho.
        </p>
      </div>

      {/* Tienda */}
      <Field label="Tienda" icon={Store} error={errors.store}>
        <select
          value={form.store}
          onChange={(e) => set('store', e.target.value)}
          className="w-full bg-transparent text-[14px] text-[var(--fg-1)] outline-none"
        >
          <option value="">Selecciona la tienda…</option>
          {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      {/* Descripción */}
      <Field label="Descripción del producto" icon={FileText} error={errors.description}>
        <input
          type="text"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Ej: Auriculares Sony WH-1000XM5 negros"
          className="w-full bg-transparent text-[14px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Valor declarado */}
        <Field label="Valor USD" icon={DollarSign} error={errors.declaredValue}>
          <input
            type="number"
            min="1"
            step="0.01"
            value={form.declaredValue}
            onChange={(e) => set('declaredValue', e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-[14px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
          />
        </Field>

        {/* Número de piezas */}
        <Field label="N° de piezas" icon={Package} error={errors.pieces}>
          <input
            type="number"
            min="1"
            value={form.pieces}
            onChange={(e) => set('pieces', e.target.value)}
            className="w-full bg-transparent text-[14px] text-[var(--fg-1)] outline-none"
          />
        </Field>
      </div>

      {/* Tracking */}
      <Field label="Número de seguimiento" icon={Hash} error={errors.trackingNumber}>
        <input
          type="text"
          value={form.trackingNumber}
          onChange={(e) => set('trackingNumber', e.target.value)}
          placeholder="Ej: 1Z999AA10123456784"
          className="w-full bg-transparent text-[14px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none font-mono"
        />
      </Field>

      {/* Transportista */}
      <Field label="Transportista" icon={Truck} error={errors.carrier}>
        <select
          value={form.carrier}
          onChange={(e) => set('carrier', e.target.value)}
          className="w-full bg-transparent text-[14px] text-[var(--fg-1)] outline-none"
        >
          <option value="">Selecciona el transportista…</option>
          {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

      {/* Factura comercial */}
      <div>
        <label className="block text-[12px] font-semibold text-[var(--fg-3)] mb-1.5 uppercase tracking-wide">
          Factura comercial (obligatoria)
        </label>
        <label className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-colors ${
          errors.factura
            ? 'border-[#EF4444] bg-[#EF4444]/[0.04]'
            : 'border-[var(--bd-2)] bg-[var(--bg-card)] hover:border-[#E31E24]/60'
        }`}>
          <Upload size={15} className="text-[var(--fg-4)] shrink-0" />
          <div className="flex-1 min-w-0">
            {facturaName
              ? <span className="text-[13.5px] text-[var(--fg-1)] truncate block">{facturaName}</span>
              : <span className="text-[13.5px] text-[var(--fg-4)]">Seleccionar archivo…</span>
            }
            <p className="text-[11px] text-[var(--fg-4)] mt-0.5">Requerida para despacho. PDF o imagen.</p>
          </div>
          <input
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { setFacturaName(f.name); setErrors((er) => ({ ...er, factura: undefined })) }
            }}
          />
        </label>
        {errors.factura && <p className="text-[11.5px] text-[#EF4444] mt-1">{errors.factura}</p>}
      </div>

      {/* Instrucciones especiales */}
      <div>
        <label className="block text-[12px] font-semibold text-[var(--fg-3)] mb-1.5 uppercase tracking-wide">
          Instrucciones especiales
        </label>
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] focus-within:border-[#E31E24]/60 focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.10)] transition-colors">
          <MessageSquare size={15} className="text-[var(--fg-4)] shrink-0 mt-0.5" />
          <textarea
            value={form.instructions}
            onChange={(e) => set('instructions', e.target.value)}
            placeholder="Instrucciones especiales para el almacén (opcional)"
            rows={3}
            className="w-full bg-transparent text-[14px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none resize-none"
          />
        </div>
      </div>

      <Button type="submit" className="w-full">Registrar pre-alerta</Button>
    </form>
  )
}

function Field({ label, icon: Icon, error, children }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--fg-3)] mb-1.5 uppercase tracking-wide">{label}</label>
      <div className={`flex items-center gap-3 h-11 px-3.5 rounded-xl border transition-colors ${
        error ? 'border-[#EF4444] bg-[#EF4444]/[0.04]' : 'border-[var(--bd-2)] bg-[var(--bg-card)] focus-within:border-[#E31E24]/60 focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.10)]'
      }`}>
        <Icon size={15} className="text-[var(--fg-4)] shrink-0" />
        {children}
      </div>
      {error && <p className="text-[11.5px] text-[#EF4444] mt-1">{error}</p>}
    </div>
  )
}
