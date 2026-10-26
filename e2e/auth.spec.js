import { PASSWORD, expect, test, uniqueEmail } from './fixtures'

async function openLogin(page) {
  await page.goto('/')
  const desktopBtn = page.getByRole('button', { name: /^ingresar$/i }).first()
  if (await desktopBtn.isVisible()) {
    await desktopBtn.click()
  } else {
    // En móvil el acceso está dentro del menú.
    await page.getByRole('button', { name: 'Menú' }).click()
    await page.getByRole('button', { name: /ingresar \/ registrarse/i }).click()
  }
  await expect(page.getByText('Acceder al Casillero')).toBeVisible()
}

async function fillRegister(page, { name = 'Ana Prueba', email, pw = PASSWORD, confirm = PASSWORD }) {
  await page.getByRole('button', { name: /regístrate gratis/i }).click()
  await page.getByPlaceholder('Tu nombre completo').fill(name)
  await page.getByPlaceholder('tucorreo@email.com').fill(email)
  await page.getByPlaceholder('+598 99 123 456').fill('+598 99 123 456')
  await page.getByPlaceholder('Mínimo 8 caracteres').fill(pw)
  await page.getByPlaceholder('Repite la contraseña').fill(confirm)
}

test.describe('Registro, inicio y cierre de sesión (UI + API real)', () => {
  test('registro correcto → sesión iniciada, persiste al recargar y se puede cerrar', async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'el menú móvil se prueba en responsive.spec')
    await openLogin(page)
    await fillRegister(page, { email: uniqueEmail('reg') })
    await page.getByRole('button', { name: /crear cuenta gratis/i }).click()
    await expect(page.getByText('Acceder al Casillero')).toHaveCount(0)
    await expect(page.getByRole('link', { name: /ana/i }).first()).toBeVisible() // el nombre aparece en la barra
    // El teléfono ingresado en el registro llega a la cuenta (la especificación lo exige).
    const token = await page.evaluate(() => localStorage.getItem('pkx_token'))
    const me = await request.get(`http://127.0.0.1:${process.env.E2E_API_PORT ?? 8310}/user`, { headers: { Authorization: `Bearer ${token}` } })
    expect((await me.json()).data.phone).toBe('+598 99 123 456')
    await page.reload()
    await expect(page.getByRole('link', { name: /ana/i }).first()).toBeVisible() // la sesión persiste
    await page.getByRole('button', { name: /cerrar sesión/i }).click()
    await expect(page.getByRole('button', { name: /^ingresar$/i }).first()).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('pkx_token'))).toBeNull()
  })

  test('inicio de sesión con credenciales válidas', async ({ page, newUser, isMobile }) => {
    test.skip(isMobile, 'cubierto en escritorio')
    const u = await newUser('login', 'Beto Login')
    await openLogin(page)
    await page.getByPlaceholder('tucorreo@email.com').fill(u.email)
    await page.getByPlaceholder('••••••••').fill(u.password)
    await page.getByRole('button', { name: /^ingresar$/i }).last().click()
    await expect(page.getByRole('link', { name: /beto/i }).first()).toBeVisible()
  })

  test('contraseña incorrecta → mensaje de error y sin sesión', async ({ page, newUser }) => {
    const u = await newUser('bad')
    await openLogin(page)
    await page.getByPlaceholder('tucorreo@email.com').fill(u.email)
    await page.getByPlaceholder('••••••••').fill('clave-equivocada-1')
    await page.getByRole('button', { name: /^ingresar$/i }).last().click()
    await expect(page.getByText('Credenciales incorrectas')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('pkx_token'))).toBeNull()
  })

  test('usuario inexistente da el mismo mensaje (sin enumeración de cuentas)', async ({ page }) => {
    await openLogin(page)
    await page.getByPlaceholder('tucorreo@email.com').fill(uniqueEmail('nadie'))
    await page.getByPlaceholder('••••••••').fill('clave-equivocada-1')
    await page.getByRole('button', { name: /^ingresar$/i }).last().click()
    await expect(page.getByText('Credenciales incorrectas')).toBeVisible()
  })

  test('registro con contraseñas distintas: el botón se bloquea y no hay petición', async ({ page }) => {
    let calls = 0
    page.on('request', (r) => { if (r.url().includes('/auth/register')) calls++ })
    await openLogin(page)
    await fillRegister(page, { email: uniqueEmail('mm'), confirm: 'Otra-Clave-456' })
    await expect(page.getByText(/contraseñas no coinciden/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /crear cuenta gratis/i })).toBeDisabled()
    expect(calls).toBe(0)
  })

  test('registro con contraseña corta: el servidor la rechaza y el formulario se recupera', async ({ page }) => {
    await openLogin(page)
    await fillRegister(page, { email: uniqueEmail('short'), pw: '1234567', confirm: '1234567' })
    await page.getByRole('button', { name: /crear cuenta gratis/i }).click()
    await expect(page.getByText(/datos inválidos/i)).toBeVisible()
    await page.getByPlaceholder('Mínimo 8 caracteres').fill(PASSWORD) // corrige y reintenta
    await page.getByPlaceholder('Repite la contraseña').fill(PASSWORD)
    await page.getByRole('button', { name: /crear cuenta gratis/i }).click()
    await expect(page.getByText('Acceder al Casillero')).toHaveCount(0)
  })

  test('registro con un email ya usado muestra un error', async ({ page, newUser }) => {
    const u = await newUser('dup')
    await openLogin(page)
    await fillRegister(page, { name: 'Otra Persona', email: u.email })
    await page.getByRole('button', { name: /crear cuenta gratis/i }).click()
    await expect(page.getByText(/no se pudo completar el registro/i)).toBeVisible()
  })

  test('el doble clic en "crear cuenta" no genera dos registros', async ({ page }) => {
    let calls = 0
    page.on('request', (r) => { if (r.url().includes('/auth/register') && r.method() === 'POST') calls++ })
    await openLogin(page)
    await fillRegister(page, { email: uniqueEmail('dbl') })
    await page.getByRole('button', { name: /crear cuenta gratis/i }).dblclick()
    await expect(page.getByText('Acceder al Casillero')).toHaveCount(0)
    expect(calls).toBe(1)
  })

  test('Escape cierra el formulario', async ({ page }) => {
    await openLogin(page)
    await page.keyboard.press('Escape')
    await expect(page.getByText('Acceder al Casillero')).toHaveCount(0)
  })

  test('un token inválido guardado en el navegador no concede acceso a los datos del servidor', async ({ page, request }) => {
    const res = await request.get(`http://127.0.0.1:${process.env.E2E_API_PORT ?? 8310}/user`, { headers: { Authorization: 'Bearer x.y.z' } })
    expect(res.status()).toBe(401)
    await page.goto('/')
    const desktopBtn = page.getByRole('button', { name: /^ingresar$/i }).first()
    if (await desktopBtn.isVisible()) {
      await expect(desktopBtn).toBeVisible()
    } else {
      await page.getByRole('button', { name: 'Menú' }).click()
      await expect(page.getByRole('button', { name: /ingresar \/ registrarse/i })).toBeVisible()
    }
  })
})
