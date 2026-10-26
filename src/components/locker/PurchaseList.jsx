import { useState } from 'react'
import { api } from '../../lib/api'
import { formatDate, formatUSD } from '../../lib/format'

const STATUS = {
  registered: 'Registrada',
  in_review: 'En revisión',
  accepted: 'Aceptada',
  partially_received: 'Recibida parcialmente',
  fully_received: 'Recibida completa',
  cancelled: 'Cancelada',
}

/** Compras registradas del cliente (datos reales de la API). Permite sumar seguimientos si la tienda divide el envío. */
export default function PurchaseList({ purchases, error, onChanged }) {
  if (error) return <p role="alert" className="text-[14px] text-[var(--err-text)]">{error}</p>
  if (purchases === null) return <p className="text-[14px] text-[var(--fg-3)]">Cargando…</p>
  if (purchases.length === 0) return <p className="prose-calm">Todavía no registraste compras. Registrá cada compra después de pagarla en la tienda.</p>
  return (
    <ul className="space-y-4">
      {purchases.map((p) => <PurchaseItem key={p.code} purchase={p} onChanged={onChanged} />)}
    </ul>
  )
}

function PurchaseItem({ purchase: p, onChanged }) {
  const [open, setOpen] = useState(false)
  const [trk, setTrk] = useState('')
  const [carrier, setCarrier] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    if (trk.trim().length < 4) { setMsg('El seguimiento necesita al menos 4 caracteres'); return }
    setBusy(true); setMsg('')
    try {
      await api.post(`/purchases/${p.code}/trackings`, { tracking_number: trk.trim(), carrier: carrier.trim() || undefined })
      setTrk(''); setCarrier(''); setOpen(false)
      await onChanged?.()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-[var(--bd-2)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] font-medium text-[var(--fg-1)]">{p.code}</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--fg-1)]">{p.store} · pedido {p.store_order_number}</p>
          <p className="mt-1 text-[13px] text-[var(--fg-3)]">
            {formatDate(p.purchased_on)} · Para {p.recipient_label || p.recipient_name} · {formatUSD(Number(p.products_amount ?? 0))} en productos
          </p>
        </div>
        <span className="text-[12.5px] font-semibold text-[var(--fg-2)]">{STATUS[p.status] ?? p.status}</span>
      </div>

      {p.trackings?.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Seguimientos">
          {p.trackings.map((t) => (
            <li key={t.tracking_number} className="rounded-full border border-[var(--bd-2)] px-3 py-1 text-[12px] font-mono text-[var(--fg-2)]">
              {t.tracking_number}{t.carrier ? ` · ${t.carrier}` : ''}
            </li>
          ))}
        </ul>
      )}

      {p.status !== 'cancelled' && (
        <div className="mt-4">
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="link-arrow cursor-pointer" aria-label={`Agregar seguimiento a ${p.code}`}>Agregar seguimiento</button>
          ) : (
            <form onSubmit={add} className="flex flex-wrap items-end gap-3" aria-label={`Nuevo seguimiento de ${p.code}`}>
              <div>
                <label htmlFor={`trk-${p.code}`} className="block text-[12px] font-semibold text-[var(--fg-2)] mb-1.5">Seguimiento</label>
                <input id={`trk-${p.code}`} value={trk} onChange={(e) => setTrk(e.target.value)} maxLength={60} className="h-11 px-3 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[14px] font-mono text-[var(--fg-1)] outline-none focus:border-[var(--color-brand)]" />
              </div>
              <div>
                <label htmlFor={`car-${p.code}`} className="block text-[12px] font-semibold text-[var(--fg-2)] mb-1.5">Transportista (opcional)</label>
                <input id={`car-${p.code}`} value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={40} className="h-11 px-3 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[14px] text-[var(--fg-1)] outline-none focus:border-[var(--color-brand)]" />
              </div>
              <button type="submit" disabled={busy} className="h-11 px-5 rounded-lg border border-[var(--bd-3)] text-[14px] font-semibold text-[var(--fg-1)] hover:border-[var(--fg-1)] disabled:opacity-50 cursor-pointer">Guardar</button>
              <button type="button" onClick={() => { setOpen(false); setMsg('') }} className="h-11 px-3 text-[14px] text-[var(--fg-3)] cursor-pointer">Cancelar</button>
            </form>
          )}
          {msg && <p role="alert" className="mt-2 text-[13px] text-[var(--err-text)]">{msg}</p>}
        </div>
      )}
    </li>
  )
}
