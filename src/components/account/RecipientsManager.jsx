import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import Button from '../ui/Button'
import { api } from '../../lib/api'
import { provincesCuba } from '../../lib/shipping'

const EMPTY = { label: '', recipient: '', phone: '', province: '', municipality: '', street: '', id_doc: '', is_default: false }

/**
 * Destinatarios en Cuba (alta, edición y baja) sobre la API real. Cada cuenta ve solo los suyos.
 * El documento de identidad es opcional: se pide únicamente si el operador lo exige y se guarda cifrado (la API
 * devuelve solo los últimos dígitos enmascarados).
 */
export default function RecipientsManager() {
  const [list, setList] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | id
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/user/addresses')
      setList(res.data)
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])

  useEffect(() => {
    // La carga inicial sincroniza con un sistema externo (la API); el estado se actualiza al resolver.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function startNew() {
    setForm({ ...EMPTY, is_default: (list ?? []).length === 0 })
    setErrors({}); setFormError(''); setNotice(''); setEditing('new')
  }

  function startEdit(a) {
    setForm({
      label: a.label ?? '', recipient: a.recipient, phone: a.phone ?? '', province: a.province,
      municipality: a.municipality ?? '', street: a.street, id_doc: '', is_default: a.is_default,
    })
    setErrors({}); setFormError(''); setNotice(''); setEditing(a.id)
  }

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })) }

  function validate() {
    const e = {}
    if (form.recipient.trim().length < 2) e.recipient = 'Ingresá el nombre completo de quien recibe'
    if (!form.phone.trim()) e.phone = 'Ingresá un teléfono de contacto'
    if (!form.province) e.province = 'Elegí la provincia'
    if (form.street.trim().length < 3) e.street = 'Ingresá la dirección'
    if (form.id_doc && !/^[A-Za-z0-9\-.]+$/.test(form.id_doc)) e.id_doc = 'Solo letras, números, guiones y puntos'
    return e
  }

  async function submit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const body = {
      label: form.label.trim() || undefined,
      recipient: form.recipient.trim(),
      phone: form.phone.trim(),
      province: form.province,
      municipality: form.municipality.trim() || undefined,
      street: form.street.trim(),
      is_default: form.is_default,
    }
    if (form.id_doc.trim()) body.id_doc = form.id_doc.trim() // en edición, vacío = conservar el documento guardado
    setSaving(true); setFormError('')
    try {
      if (editing === 'new') await api.post('/user/addresses', body)
      else await api.put(`/user/addresses/${editing}`, body)
      await load()
      setNotice(editing === 'new' ? 'Destinatario agregado' : 'Cambios guardados')
      setEditing(null)
    } catch (err) {
      setFormError(err.message)
      if (err.errors) setErrors(err.errors)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/user/addresses/${id}`)
      setConfirmDelete(null)
      setNotice('Destinatario eliminado')
      await load()
    } catch (err) {
      setConfirmDelete(null)
      setNotice(err.message) // p. ej. tiene compras asociadas
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="font-display font-bold text-xl text-[var(--fg-1)]">Destinatarios en Cuba</h2>
        {editing === null && <Button variant="subtle" size="sm" onClick={startNew}><Plus size={15} /> Agregar</Button>}
      </div>

      {notice && <p role="status" className="mb-5 text-[14px] text-[var(--fg-2)]">{notice}</p>}
      {loadError && <p role="alert" className="mb-5 text-[14px] text-[var(--err-text)]">{loadError}</p>}

      {editing !== null && (
        <form onSubmit={submit} noValidate aria-label={editing === 'new' ? 'Nuevo destinatario' : 'Editar destinatario'} className="card-surface rounded-xl p-6 mb-8 space-y-5">
          {formError && <p role="alert" className="text-[14px] text-[var(--err-text)]">{formError}</p>}
          <div className="grid sm:grid-cols-2 gap-5">
            <Field id="rc-recipient" label="Nombre completo de quien recibe" error={errors.recipient} value={form.recipient} onChange={(v) => set('recipient', v)} maxLength={120} autoComplete="off" />
            <Field id="rc-phone" label="Teléfono en Cuba" error={errors.phone} value={form.phone} onChange={(v) => set('phone', v)} maxLength={30} type="tel" placeholder="+53 5…" />
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="rc-province" className="block text-[13px] font-semibold text-[var(--fg-2)] mb-2">Provincia</label>
              <select
                id="rc-province" value={form.province} onChange={(ev) => set('province', ev.target.value)}
                aria-invalid={Boolean(errors.province)} aria-describedby={errors.province ? 'rc-province-err' : undefined}
                className="w-full h-12 px-3 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[15px] text-[var(--fg-1)] outline-none focus:border-[var(--color-brand)]"
              >
                <option value="">Elegí la provincia…</option>
                {provincesCuba.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              {errors.province && <p id="rc-province-err" className="mt-2 text-[13px] text-[var(--err-text)]">{errors.province}</p>}
            </div>
            <Field id="rc-municipality" label="Municipio (opcional)" value={form.municipality} onChange={(v) => set('municipality', v)} maxLength={80} />
          </div>
          <Field id="rc-street" label="Dirección" error={errors.street} value={form.street} onChange={(v) => set('street', v)} maxLength={300} placeholder="Calle, número, entre calles, reparto" />
          <div className="grid sm:grid-cols-2 gap-5">
            <Field id="rc-label" label="Nombre para identificarlo (opcional)" value={form.label} onChange={(v) => set('label', v)} maxLength={100} placeholder="Ej: Mamá" />
            <div>
              <Field id="rc-doc" label={editing === 'new' ? 'Documento de identidad (opcional)' : 'Documento de identidad (vacío = conservar el guardado)'} error={errors.id_doc} value={form.id_doc} onChange={(v) => set('id_doc', v)} maxLength={30} autoComplete="off" />
              <p className="mt-2 text-[12.5px] text-[var(--fg-4)]">Solo se pide si el operador lo exige. Se guarda cifrado.</p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-[14px] text-[var(--fg-2)] cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(ev) => set('is_default', ev.target.checked)} className="w-4 h-4 accent-[var(--color-brand)]" />
            Usar como destinatario predeterminado
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar destinatario'}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </form>
      )}

      {list === null && !loadError && <p className="text-[14px] text-[var(--fg-3)]">Cargando…</p>}
      {list?.length === 0 && editing === null && (
        <p className="prose-calm">Todavía no cargaste destinatarios. Los necesitás para registrar una compra.</p>
      )}

      <ul className="grid sm:grid-cols-2 gap-4">
        {(list ?? []).map((a) => {
          const prov = provincesCuba.find((p) => p.code === a.province)
          return (
            <li key={a.id} className="card-surface rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-display font-bold text-[15px] text-[var(--fg-1)]">{a.label || a.recipient}</h3>
                {a.is_default && <span className="text-[12px] font-medium text-[var(--ok-text)]">Predeterminado</span>}
              </div>
              <dl className="space-y-1.5 text-[13px]">
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Recibe</dt><dd className="text-[var(--fg-2)]">{a.recipient}</dd></div>
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Teléfono</dt><dd className="text-[var(--fg-2)]">{a.phone}</dd></div>
                <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Dirección</dt><dd className="text-[var(--fg-2)]">{a.street}{a.municipality ? `, ${a.municipality}` : ''}, {prov?.name ?? a.province_name}</dd></div>
                {a.id_doc && <div className="flex gap-2"><dt className="text-[var(--fg-4)] w-20 shrink-0">Documento</dt><dd className="text-[var(--fg-2)] font-mono">{a.id_doc}</dd></div>}
              </dl>
              <div className="mt-5 flex items-center gap-5">
                <button type="button" onClick={() => startEdit(a)} aria-label={`Editar ${a.label || a.recipient}`} className="link-arrow cursor-pointer">Editar</button>
                {confirmDelete === a.id ? (
                  <span className="flex items-center gap-3 text-[13px]">
                    ¿Eliminar?
                    <button type="button" onClick={() => remove(a.id)} className="font-semibold text-[var(--err-text)] cursor-pointer">Sí, eliminar</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="text-[var(--fg-3)] cursor-pointer">No</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(a.id)} aria-label={`Eliminar ${a.label || a.recipient}`} className="text-[13px] text-[var(--fg-3)] hover:text-[var(--err-text)] cursor-pointer">Eliminar</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Field({ id, label, value, onChange, error, type = 'text', ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--fg-2)] mb-2">{label}</label>
      <input
        id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
        className="w-full h-12 px-4 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[15px] text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none focus:border-[var(--color-brand)]"
        {...rest}
      />
      {error && <p id={`${id}-err`} className="mt-2 text-[13px] text-[var(--err-text)]">{error}</p>}
    </div>
  )
}
