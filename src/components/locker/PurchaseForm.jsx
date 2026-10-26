import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Plus, X } from 'lucide-react'
import Button from '../ui/Button'
import { api } from '../../lib/api'
import { formatUSD } from '../../lib/format'
import { TARIFAS } from '../../lib/shipping'

const STORES = ['Amazon', 'Walmart', 'Best Buy', 'eBay', 'Home Depot', 'Temu', 'Target', 'Costco', 'Newegg', 'AliExpress USA']
const OTHER = 'Otra tienda'
const CARRIERS = ['', 'Amazon Logistics', 'DHL', 'FedEx', 'UPS', 'USPS', 'Otro']
const MAX_FILE_MB = 5
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = () => ({ description: '', url: '', model: '', qty: '1', unit_price: '', discount: '' })
const emptyTrk = () => ({ tracking_number: '', carrier: '' })
const money = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0)
const lineAmount = (it) => Math.max(0, Math.round((money(it.unit_price) * (parseInt(it.qty, 10) || 0) - money(it.discount)) * 100) / 100)

/**
 * Registro de compra (obligatorio en esta versión: la tienda no informa qué se compró).
 * Datos del documento de alcance: tienda, pedido, fecha, moneda, comprobante, detalle por producto
 * (enlace, descripción, modelo, cantidad, precio, descuentos), impuestos y envío interno por separado,
 * seguimientos (varios), destinatario, observaciones, resumen de costos y aceptación de condiciones.
 * El producto NO se paga aquí: se paga en la tienda.
 */
export default function PurchaseForm({ onCreated }) {
  const [recipients, setRecipients] = useState(null)
  const [storeChoice, setStoreChoice] = useState('')
  const [otherStore, setOtherStore] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [purchasedOn, setPurchasedOn] = useState(today())
  const [items, setItems] = useState([emptyItem()])
  const [taxes, setTaxes] = useState('')
  const [shipping, setShipping] = useState('')
  const [trackings, setTrackings] = useState([emptyTrk()])
  const [recipientId, setRecipientId] = useState('')
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    let active = true
    api.get('/user/addresses')
      .then((res) => {
        if (!active) return
        setRecipients(res.data)
        const def = res.data.find((a) => a.is_default) ?? res.data[0]
        if (def) setRecipientId(String(def.id))
      })
      .catch(() => active && setRecipients([]))
    return () => { active = false }
  }, [])

  const productsAmount = useMemo(() => items.reduce((s, it) => s + lineAmount(it), 0), [items])
  const commission = Math.round(productsAmount * TARIFAS.commissionRate * 100) / 100
  const store = storeChoice === OTHER ? otherStore.trim() : storeChoice

  const clear = (k) => setErrors((e) => ({ ...e, [k]: undefined }))
  const setItem = (i, k, v) => { setItems((l) => l.map((it, n) => (n === i ? { ...it, [k]: v } : it))); clear('items') }
  const setTrk = (i, k, v) => { setTrackings((l) => l.map((t, n) => (n === i ? { ...t, [k]: v } : t))); clear('trackings') }

  function validate() {
    const e = {}
    if (store.length < 2) e.store = 'Elegí la tienda'
    if (orderNumber.trim().length < 3) e.orderNumber = 'Ingresá el número de pedido de la tienda'
    if (!purchasedOn) e.purchasedOn = 'Ingresá la fecha de la compra'
    else if (purchasedOn > today()) e.purchasedOn = 'La fecha no puede ser futura'
    if (!recipientId) e.recipientId = 'Elegí el destinatario en Cuba'
    const badItem = items.find((it) => it.description.trim().length < 2 || !(money(it.unit_price) > 0) || !(parseInt(it.qty, 10) >= 1))
    if (badItem) e.items = 'Cada producto necesita descripción, cantidad y precio unitario'
    else if (items.some((it) => money(it.discount) > money(it.unit_price) * (parseInt(it.qty, 10) || 0))) e.items = 'Un descuento supera el importe del producto'
    else if (items.some((it) => it.url && !/^https?:\/\//i.test(it.url.trim()))) e.items = 'El enlace del producto debe empezar con http:// o https://'
    const trk = trackings.filter((t) => t.tracking_number.trim())
    if (trk.some((t) => t.tracking_number.trim().length < 4)) e.trackings = 'Cada seguimiento necesita al menos 4 caracteres'
    else if (new Set(trk.map((t) => t.tracking_number.trim().toUpperCase())).size !== trk.length) e.trackings = 'Hay seguimientos repetidos'
    if (!receipt) e.receipt = 'El comprobante es obligatorio'
    else if (!FILE_TYPES.includes(receipt.type)) e.receipt = 'El comprobante debe ser PDF, JPG, PNG o WEBP'
    else if (receipt.size > MAX_FILE_MB * 1024 * 1024) e.receipt = `El comprobante no puede superar ${MAX_FILE_MB} MB`
    if (!accepted) e.accepted = 'Tenés que aceptar las condiciones'
    return e
  }

  async function submit(ev) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    setServerError('')
    if (Object.keys(e).length) return
    const fd = new FormData()
    fd.append('recipient_id', recipientId)
    fd.append('store', store)
    fd.append('store_order_number', orderNumber.trim())
    fd.append('purchased_on', purchasedOn)
    if (taxes) fd.append('store_taxes', money(taxes).toFixed(2))
    if (shipping) fd.append('store_shipping', money(shipping).toFixed(2))
    if (notes.trim()) fd.append('notes', notes.trim())
    fd.append('accept_terms', '1')
    fd.append('items', JSON.stringify(items.map((it) => ({
      description: it.description.trim(),
      url: it.url.trim() || undefined,
      model: it.model.trim() || undefined,
      qty: parseInt(it.qty, 10),
      unit_price: money(it.unit_price).toFixed(2),
      discount: it.discount ? money(it.discount).toFixed(2) : undefined,
    }))))
    const trk = trackings.filter((t) => t.tracking_number.trim())
    if (trk.length) fd.append('trackings', JSON.stringify(trk.map((t) => ({ tracking_number: t.tracking_number.trim(), carrier: t.carrier || undefined }))))
    fd.append('receipt', receipt)
    setSaving(true)
    try {
      const res = await api.upload('/purchases', fd)
      setCreated(res.data)
      onCreated?.(res.data)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function again() {
    setCreated(null); setStoreChoice(''); setOtherStore(''); setOrderNumber(''); setPurchasedOn(today())
    setItems([emptyItem()]); setTaxes(''); setShipping(''); setTrackings([emptyTrk()]); setNotes('')
    setReceipt(null); setAccepted(false); setErrors({}); setServerError('')
  }

  if (created) {
    return (
      <div role="status" className="py-10 text-center">
        <CheckCircle2 size={28} className="mx-auto text-[var(--ok-text)] mb-4" aria-hidden="true" />
        <p className="text-[16px] font-semibold text-[var(--fg-1)]">¡Compra registrada!</p>
        <p className="mt-2 text-[14px] text-[var(--fg-3)]">Código <span className="font-mono font-medium text-[var(--fg-1)]">{created.code}</span>. Te avisamos cuando llegue a EE.UU.</p>
        <Button className="mt-8" variant="outline" onClick={again}>Registrar otra compra</Button>
      </div>
    )
  }

  if (recipients !== null && recipients.length === 0) {
    return (
      <div>
        <p className="prose-calm">Antes de registrar una compra necesitás al menos un destinatario en Cuba.</p>
        <Link to="/cuenta" className="link-arrow mt-6">Agregar destinatario</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Registrar una compra" className="space-y-8">
      <p className="text-[14px] leading-[1.7] text-[var(--fg-3)]">
        El producto lo pagás en la tienda, no acá. Registrá la compra con el comprobante para que podamos identificar tus paquetes.
      </p>
      {serverError && <p role="alert" className="text-[14px] text-[var(--err-text)]">{serverError}</p>}

      <fieldset className="space-y-5">
        <legend className="eyebrow before:hidden mb-4">La compra</legend>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field id="pf-store" label="Tienda" error={errors.store}>
            <select id="pf-store" value={storeChoice} onChange={(ev) => { setStoreChoice(ev.target.value); clear('store') }} className={ctl}>
              <option value="">Elegí la tienda…</option>
              {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value={OTHER}>{OTHER}</option>
            </select>
          </Field>
          {storeChoice === OTHER && (
            <Field id="pf-store-other" label="Nombre de la tienda" error={errors.store}>
              <input id="pf-store-other" value={otherStore} onChange={(ev) => { setOtherStore(ev.target.value); clear('store') }} maxLength={100} className={ctl} />
            </Field>
          )}
          <Field id="pf-order" label="Número de pedido de la tienda" error={errors.orderNumber}>
            <input id="pf-order" value={orderNumber} onChange={(ev) => { setOrderNumber(ev.target.value); clear('orderNumber') }} maxLength={100} placeholder="Ej: 112-3456789-0123456" className={`${ctl} font-mono`} />
          </Field>
          <Field id="pf-date" label="Fecha de la compra" error={errors.purchasedOn}>
            <input id="pf-date" type="date" value={purchasedOn} max={today()} onChange={(ev) => { setPurchasedOn(ev.target.value); clear('purchasedOn') }} className={ctl} />
          </Field>
          <Field id="pf-currency" label="Moneda">
            <input id="pf-currency" value="USD" readOnly className={`${ctl} opacity-70`} />
          </Field>
        </div>
        <Field id="pf-receipt" label="Comprobante de la compra (PDF o imagen, hasta 5 MB)" error={errors.receipt}>
          <input
            id="pf-receipt" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(ev) => { setReceipt(ev.target.files?.[0] ?? null); clear('receipt') }}
            className="block w-full text-[14px] text-[var(--fg-2)] file:mr-4 file:h-11 file:px-5 file:rounded-lg file:border file:border-[var(--bd-3)] file:bg-transparent file:text-[var(--fg-1)] file:font-semibold file:cursor-pointer"
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="eyebrow before:hidden mb-4">Productos</legend>
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-[var(--bd-2)] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[var(--fg-2)]">Producto {i + 1}</p>
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((l) => l.filter((_, n) => n !== i))} aria-label={`Quitar producto ${i + 1}`} className="w-9 h-9 flex items-center justify-center text-[var(--fg-3)] hover:text-[var(--err-text)] cursor-pointer"><X size={16} /></button>
              )}
            </div>
            <Field id={`pf-desc-${i}`} label="Descripción">
              <input id={`pf-desc-${i}`} value={it.description} onChange={(ev) => setItem(i, 'description', ev.target.value)} maxLength={300} placeholder="Ej: Lámpara solar recargable" className={ctl} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id={`pf-model-${i}`} label="Modelo (opcional)"><input id={`pf-model-${i}`} value={it.model} onChange={(ev) => setItem(i, 'model', ev.target.value)} maxLength={100} className={ctl} /></Field>
              <Field id={`pf-url-${i}`} label="Enlace del producto (opcional)"><input id={`pf-url-${i}`} type="url" value={it.url} onChange={(ev) => setItem(i, 'url', ev.target.value)} maxLength={1000} placeholder="https://…" className={ctl} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field id={`pf-qty-${i}`} label="Cantidad"><input id={`pf-qty-${i}`} type="number" min="1" max="1000" inputMode="numeric" value={it.qty} onChange={(ev) => setItem(i, 'qty', ev.target.value)} className={ctl} /></Field>
              <Field id={`pf-price-${i}`} label="Precio unitario (USD)"><input id={`pf-price-${i}`} type="number" min="0" step="0.01" inputMode="decimal" value={it.unit_price} onChange={(ev) => setItem(i, 'unit_price', ev.target.value)} className={ctl} /></Field>
              <Field id={`pf-disc-${i}`} label="Descuento (USD)"><input id={`pf-disc-${i}`} type="number" min="0" step="0.01" inputMode="decimal" value={it.discount} onChange={(ev) => setItem(i, 'discount', ev.target.value)} className={ctl} /></Field>
            </div>
            <p className="text-[13px] text-[var(--fg-3)]">Importe del producto: <span className="font-semibold text-[var(--fg-1)] tabular-nums">{formatUSD(lineAmount(it))}</span></p>
          </div>
        ))}
        {errors.items && <p role="alert" className="text-[13px] text-[var(--err-text)]">{errors.items}</p>}
        {items.length < 50 && (
          <Button type="button" variant="subtle" size="sm" onClick={() => setItems((l) => [...l, emptyItem()])}><Plus size={15} /> Agregar producto</Button>
        )}
        <div className="grid sm:grid-cols-2 gap-5 pt-2">
          <Field id="pf-taxes" label="Impuestos cobrados por la tienda (USD)"><input id="pf-taxes" type="number" min="0" step="0.01" inputMode="decimal" value={taxes} onChange={(ev) => setTaxes(ev.target.value)} className={ctl} /></Field>
          <Field id="pf-ship" label="Envío interno de la tienda en EE.UU. (USD)"><input id="pf-ship" type="number" min="0" step="0.01" inputMode="decimal" value={shipping} onChange={(ev) => setShipping(ev.target.value)} className={ctl} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="eyebrow before:hidden mb-4">Seguimientos de la tienda o del transportista (opcional)</legend>
        {trackings.map((t, i) => (
          <div key={i} className="grid sm:grid-cols-[1fr_200px_auto] gap-4 items-end">
            <Field id={`pf-trk-${i}`} label={`Seguimiento ${i + 1}`}><input id={`pf-trk-${i}`} value={t.tracking_number} onChange={(ev) => setTrk(i, 'tracking_number', ev.target.value)} maxLength={60} className={`${ctl} font-mono`} /></Field>
            <Field id={`pf-carrier-${i}`} label="Transportista">
              <select id={`pf-carrier-${i}`} value={t.carrier} onChange={(ev) => setTrk(i, 'carrier', ev.target.value)} className={ctl}>
                {CARRIERS.map((c) => <option key={c} value={c}>{c || 'Sin indicar'}</option>)}
              </select>
            </Field>
            {trackings.length > 1 && (
              <button type="button" onClick={() => setTrackings((l) => l.filter((_, n) => n !== i))} aria-label={`Quitar seguimiento ${i + 1}`} className="w-11 h-11 flex items-center justify-center text-[var(--fg-3)] hover:text-[var(--err-text)] cursor-pointer"><X size={16} /></button>
            )}
          </div>
        ))}
        {errors.trackings && <p role="alert" className="text-[13px] text-[var(--err-text)]">{errors.trackings}</p>}
        {trackings.length < 20 && (
          <Button type="button" variant="subtle" size="sm" onClick={() => setTrackings((l) => [...l, emptyTrk()])}><Plus size={15} /> Agregar otro seguimiento</Button>
        )}
        <p className="text-[12.5px] text-[var(--fg-4)]">Si la tienda divide la compra en varios envíos, agregá un seguimiento por cada uno. También podés sumarlos después.</p>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="eyebrow before:hidden mb-4">Destinatario y observaciones</legend>
        <Field id="pf-recipient" label="Destinatario en Cuba" error={errors.recipientId}>
          <select id="pf-recipient" value={recipientId} onChange={(ev) => { setRecipientId(ev.target.value); clear('recipientId') }} className={ctl}>
            <option value="">Elegí el destinatario…</option>
            {(recipients ?? []).map((a) => <option key={a.id} value={a.id}>{a.label || a.recipient} — {a.province_name}</option>)}
          </select>
        </Field>
        <Field id="pf-notes" label="Observaciones (opcional)">
          <textarea id="pf-notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} maxLength={500} rows={3} className={`${ctl} h-auto py-3`} />
        </Field>
      </fieldset>

      <section aria-labelledby="pf-summary" className="rounded-xl bg-[var(--bg-alt)] p-5">
        <h3 id="pf-summary" className="eyebrow before:hidden mb-4">Resumen de costos</h3>
        <dl className="space-y-2 text-[14px]">
          <Row label="Productos (se pagan en la tienda)" value={formatUSD(productsAmount)} />
          <Row label={`Comisión de gestión (${TARIFAS.commissionRate * 100}%)`} value={formatUSD(commission)} />
          <Row label="Envío" value="Se calcula con el peso real" />
        </dl>
        <p className="mt-4 text-[12.5px] leading-[1.7] text-[var(--fg-4)]">
          Estimación. La liquidación final la emite Optimus al pesar el paquete. La aduana de Cuba no está incluida: la paga quien recibe.
        </p>
      </section>

      <div>
        <label className="flex items-start gap-3 text-[14px] leading-[1.6] text-[var(--fg-2)] cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(ev) => { setAccepted(ev.target.checked); clear('accepted') }} className="mt-1 w-4 h-4 accent-[var(--color-brand)]" />
          <span>Revisé el resumen de costos y acepto las <Link to="/contacto" className="underline">condiciones del servicio</Link>.</span>
        </label>
        {errors.accepted && <p role="alert" className="mt-2 text-[13px] text-[var(--err-text)]">{errors.accepted}</p>}
      </div>

      <Button type="submit" size="lg" disabled={saving}>{saving ? 'Registrando…' : 'Registrar compra'}</Button>
    </form>
  )
}

const ctl = 'w-full h-12 px-3 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[15px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none focus:border-[var(--color-brand)]'

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--fg-2)] mb-2">{label}</label>
      {children}
      {error && <p role="alert" className="mt-2 text-[13px] text-[var(--err-text)]">{error}</p>}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--fg-3)]">{label}</dt>
      <dd className="font-semibold text-[var(--fg-1)] tabular-nums text-right">{value}</dd>
    </div>
  )
}
