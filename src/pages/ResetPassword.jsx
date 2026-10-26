import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { PageHeader, Section } from '../components/ui/Layout'
import { useAuth } from '../context/AuthContext'

const TOKEN_FORMAT = /^[a-f0-9]{64}$/

/** Destino del enlace que se envía por correo: define una contraseña nueva con el token de un solo uso. */
export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { resetPassword, loading, error, clearError } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)

  const validToken = TOKEN_FORMAT.test(token)
  const mismatch = confirm.length > 0 && password !== confirm

  async function submit(e) {
    e.preventDefault()
    if (mismatch || password.length < 8) return
    clearError()
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch {
      // el mensaje queda en `error`
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Mi cuenta" title="Nueva contraseña" lead="Elegí una contraseña de al menos 8 caracteres." />
      <Section tight>
        <div className="max-w-[460px]">
          {done ? (
            <div role="status">
              <p className="prose-calm">Listo: tu contraseña se actualizó y se cerraron las sesiones abiertas. Ya podés ingresar con la nueva.</p>
              <Button className="mt-8" size="lg" onClick={() => window.dispatchEvent(new Event('open-login'))}>Ingresar</Button>
            </div>
          ) : !validToken ? (
            <div role="alert">
              <p className="prose-calm">Este enlace no es válido. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".</p>
              <Button className="mt-8" size="lg" onClick={() => window.dispatchEvent(new Event('open-login'))}>Pedir un enlace nuevo</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6" noValidate>
              {error && <p role="alert" className="text-[14px] text-[var(--err-text)]">{error}</p>}
              <div>
                <label htmlFor="reset-password" className="block text-[13px] font-semibold text-[var(--fg-2)] mb-2">Contraseña nueva</label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full h-12 px-4 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[15px] text-[var(--fg-1)] outline-none focus:border-[var(--color-brand)]"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm" className="block text-[13px] font-semibold text-[var(--fg-2)] mb-2">Repetí la contraseña</label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? 'reset-mismatch' : undefined}
                  className="w-full h-12 px-4 rounded-lg border border-[var(--bd-3)] bg-[var(--bg-input)] text-[15px] text-[var(--fg-1)] outline-none focus:border-[var(--color-brand)]"
                />
                {mismatch && <p id="reset-mismatch" className="mt-2 text-[13px] text-[var(--err-text)]">Las contraseñas no coinciden</p>}
              </div>
              <Button type="submit" size="lg" disabled={loading || mismatch || password.length < 8}>
                {loading ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
            </form>
          )}
        </div>
      </Section>
    </div>
  )
}
