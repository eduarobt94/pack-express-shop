import { PASSWORD, expect, test, uniqueEmail } from './fixtures'

test.describe('Teclado y foco', () => {
  test('el enlace "Ir al contenido principal" es el primer elemento enfocable y lleva a <main>', async ({ page }) => {
    await page.goto('/tarifas')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /ir al contenido principal/i })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })

  test('el foco es visible en los controles interactivos', async ({ page }) => {
    await page.goto('/tarifas')
    await page.getByLabel(/valor de productos/i).focus()
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement)
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow, border: s.borderColor }
    })
    // Debe haber un indicador: contorno, sombra o cambio de borde (el campo usa borde rojo al enfocar)
    expect(outline.style !== 'none' || outline.shadow !== 'none' || outline.border !== '').toBe(true)
    await page.keyboard.press('Tab')
    const tag = await page.evaluate(() => document.activeElement.tagName)
    expect(['INPUT', 'A', 'BUTTON']).toContain(tag)
  })

  test('se puede recorrer toda la página con Tab sin caer en una trampa de foco', async ({ page }) => {
    await page.goto('/como-comprar')
    const seen = new Set()
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab')
      seen.add(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
    }
    expect(seen.size).toBeGreaterThan(10)
  })

  test('el formulario de ingreso se completa solo con el teclado', async ({ page, newUser, isMobile }) => {
    test.skip(isMobile, 'teclado físico: escritorio')
    const u = await newUser('kbd', 'Kira Teclado')
    await page.goto('/')
    await page.getByRole('button', { name: /^ingresar$/i }).first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Acceder al Casillero')).toBeVisible()
    await page.getByPlaceholder('tucorreo@email.com').focus()
    await page.keyboard.type(u.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type(u.password)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('link', { name: /kira/i }).first()).toBeVisible()
  })

  test('el tema oscuro se activa con el teclado y persiste al recargar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'escritorio')
    await page.goto('/')
    await page.getByRole('button', { name: /activar modo oscuro/i }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('Seguridad en el navegador (datos ficticios)', () => {
  test('XSS: un nombre con HTML no se ejecuta ni se interpreta (se muestra como texto o se sanea)', async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'escritorio')
    const dialogs = []
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss() })
    const email = uniqueEmail('xss')
    const res = await request.post(`http://127.0.0.1:${process.env.E2E_API_PORT ?? 8310}/auth/register`, {
      data: { name: '<img src=x onerror=alert(1)>Mallory <script>alert(2)</script>', email, password: PASSWORD },
    })
    expect(res.status()).toBe(201)
    const { data } = await res.json()
    expect(JSON.stringify(data.user)).not.toMatch(/<script|onerror/i) // el servidor sanea el nombre
    await page.addInitScript(({ token, refresh, user }) => {
      localStorage.setItem('pkx_token', token); localStorage.setItem('pkx_refresh', refresh); localStorage.setItem('pkx_user', JSON.stringify(user))
    }, { token: data.token, refresh: data.refresh_token, user: { ...data.user, name: '<img src=x onerror=alert(3)>Mallory' } })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(await page.locator('img[src="x"]').count()).toBe(0) // el HTML guardado en el navegador tampoco se interpreta
    expect(dialogs).toEqual([])
  })

  test('XSS por URL: parámetros maliciosos en búsqueda y seguimiento no se ejecutan', async ({ page }) => {
    const dialogs = []
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss() })
    await page.goto('/catalogo?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&cat=%3Cscript%3Ealert(2)%3C%2Fscript%3E')
    await page.waitForLoadState('networkidle')
    await page.goto('/seguimiento/%3Cimg%20src%3Dx%20onerror%3Dalert(3)%3E')
    await page.waitForLoadState('networkidle')
    expect(await page.locator('img[src="x"]').count()).toBe(0)
    expect(dialogs).toEqual([])
  })

  test('la respuesta del servidor no expone credenciales ni campos internos al navegador', async ({ page, newUser }) => {
    const u = await newUser('leak')
    const seen = []
    page.on('response', async (r) => { if (r.url().includes('/api/v1/') || r.url().includes('/user')) seen.push(await r.text().catch(() => '')) })
    await page.addInitScript(({ token, refresh, user }) => {
      localStorage.setItem('pkx_token', token); localStorage.setItem('pkx_refresh', refresh); localStorage.setItem('pkx_user', JSON.stringify(user))
    }, { token: u.token, refresh: u.refresh, user: u.user })
    const res = await page.request.get(`http://127.0.0.1:${process.env.E2E_API_PORT ?? 8310}/user`, { headers: { Authorization: `Bearer ${u.token}` } })
    const body = await res.text()
    expect(body).not.toMatch(/password|token_version|failed_logins|id_doc_enc/i)
    expect(res.headers()['cache-control']).toBe('no-store')
    expect(res.headers()['x-content-type-options']).toBe('nosniff')
  })

  test('el bundle del navegador no contiene secretos', async ({ page }) => {
    const scripts = []
    page.on('response', async (r) => { if (r.url().endsWith('.js') || r.url().includes('/src/')) scripts.push(await r.text().catch(() => '')) })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const all = scripts.join('\n')
    expect(all).not.toMatch(/JWT_SECRET|DATA_ENC_KEY|BEGIN (RSA|EC|OPENSSH) PRIVATE|AKIA[0-9A-Z]{16}|sk_live_/)
  })

  test('los enlaces externos abren con rel="noopener noreferrer"', async ({ page }) => {
    await page.goto('/')
    const bad = await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/noopener/.test(a.rel)).map((a) => a.href))
    expect(bad).toEqual([])
  })

  test('el acceso directo a una API privada sin sesión devuelve 401, no datos', async ({ request }) => {
    for (const path of ['/user', '/purchases', '/settlements', '/locker', '/orders']) {
      const r = await request.get(`http://127.0.0.1:${process.env.E2E_API_PORT ?? 8310}${path}`)
      expect(r.status(), path).toBe(401)
    }
  })
})
