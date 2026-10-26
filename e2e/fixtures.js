import { readFileSync } from 'node:fs'
import { expect, test as base } from '@playwright/test'
import { E2E_ENV } from '../playwright.config.js'

const API = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 8310}`
export const PASSWORD = 'Clave-Segura-123'

let counter = 0
/** Email único por ejecución, hilo y prueba: las pruebas no dependen del orden ni se pisan entre sí. */
export const uniqueEmail = (tag = 'u') => `${tag}.${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.uy`

/** Último token de recuperación enviado a `email` (lee el buzón de pruebas del servidor, solo disponible fuera de producción). */
export async function resetTokenFor(email, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const lines = readFileSync(E2E_ENV.MAIL_OUTBOX_FILE, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
      const mail = lines.reverse().find((m) => m.to === email)
      const token = mail?.body.match(/token=([a-f0-9]{64})/)?.[1]
      if (token) return token
    } catch { /* el archivo aún no existe */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`no llegó el correo de recuperación a ${email}`)
}

export const test = base.extend({
  /** Crea un destinatario por la API para el usuario dado. */
  addAddress: async ({ request }, provide) => {
    await provide(async (u, over = {}) => {
      const res = await request.post(`${API}/user/addresses`, {
        headers: { Authorization: `Bearer ${u.token}` },
        data: { recipient: 'Mercedes Pérez', phone: '+53 5234 5678', province: 'HAB', street: 'Calle 23 #456', is_default: true, ...over },
      })
      expect(res.status()).toBe(201)
      return (await res.json()).data
    })
  },
  /** Crea un usuario real vía API (datos ficticios) y devuelve sus credenciales y tokens. */
  newUser: async ({ request }, provide) => {
    await provide(async (tag = 'user', name = 'Usuario de Prueba') => {
      const email = uniqueEmail(tag)
      const res = await request.post(`${API}/auth/register`, { data: { name, email, password: PASSWORD } })
      expect(res.status()).toBe(201)
      const { data } = await res.json()
      return { email, password: PASSWORD, name, token: data.token, refresh: data.refresh_token, user: data.user }
    })
  },
  /** Inicia sesión sin pasar por el formulario (para pruebas que no verifican el login). */
  loginAs: async ({ page }, provide) => {
    await provide(async (u) => {
      await page.addInitScript(({ token, refresh, user }) => {
        localStorage.setItem('pkx_token', token)
        localStorage.setItem('pkx_refresh', refresh)
        localStorage.setItem('pkx_user', JSON.stringify(user))
      }, { token: u.token, refresh: u.refresh, user: u.user })
    })
  },
})

export { expect, API }
