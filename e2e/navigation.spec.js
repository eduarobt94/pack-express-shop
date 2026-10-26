import { expect, test } from './fixtures'

test.describe('Navegación y páginas públicas', () => {
  test('la portada comunica el servicio y enlaza a los pasos clave', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Optimus Envíos/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Del exterior a casa de tu familia/)
    await expect(page.getByRole('link', { name: /ver tiendas/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /calcular mi envío/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /crear mi cuenta/i })).toBeVisible()
    await page.getByRole('button', { name: /crear mi cuenta/i }).click()
    await expect(page.getByText('Crear cuenta', { exact: true })).toBeVisible() // abre directamente el registro
    await expect(page.getByText(/aduana de Cuba la paga quien recibe/i).first()).toBeVisible()
  })

  test('la portada permite rastrear una compra sin salir del primer pantallazo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('textbox', { name: 'Consultar una compra' }).fill('OPT-HAB-2026-00847')
    await page.getByRole('button', { name: /^consultar/i }).click()
    await expect(page).toHaveURL(/\/seguimiento\/OPT-HAB-2026-00847$/)
  })

  test('la portada trae el cotizador con el desglose y sin incluir la aduana', async ({ page }) => {
    await page.goto('/')
    const quote = page.locator('#cotizador')
    await expect(quote.getByLabel(/valor de productos/i)).toHaveValue('100')
    await expect(quote.getByText('$65', { exact: true }).first()).toBeVisible() // 10 + 55
    await quote.getByLabel(/peso estimado/i).fill('')
    await expect(quote.getByText('Pedí cotización', { exact: true })).toBeVisible()
  })

  test('la portada explica el proceso en cuatro pasos y enlaza al detalle', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 3, name: /registrate|comprá y registrá|pagás en la sucursal|recibe en cuba/i })).toHaveCount(4)
    await page.getByRole('link', { name: /ver los 8 pasos/i }).click()
    await expect(page).toHaveURL(/\/como-comprar$/)
  })

  test('se llega a cada sección desde la navegación', async ({ page, isMobile }) => {
    test.skip(isMobile, 'en móvil la navegación vive en el menú (ver responsive.spec)')
    await page.goto('/')
    const nav = page.locator('header')
    await nav.getByRole('link', { name: 'Cómo comprar' }).first().click()
    await expect(page).toHaveURL(/\/como-comprar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Cómo comprar' })).toBeVisible()
    await nav.getByRole('link', { name: 'Tarifas', exact: true }).first().click()
    await expect(page).toHaveURL(/\/tarifas$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tarifas y calculadora')
    await nav.getByRole('link', { name: 'Consultar compra' }).click()
    await expect(page).toHaveURL(/\/seguimiento$/)
  })

  test('Cómo comprar: ocho pasos y quién cobra cada cosa', async ({ page }) => {
    await page.goto('/como-comprar')
    await expect(page.locator('ol > li')).toHaveCount(8)
    await expect(page.getByText('A la tienda')).toBeVisible()
    await expect(page.getByText(/la aduana/i).first()).toBeVisible()
  })

  test('Contacto: preguntas frecuentes se despliegan y las condiciones figuran como pendientes', async ({ page }) => {
    await page.goto('/contacto')
    const q = page.getByText('¿Pago el producto a Optimus?')
    await q.click()
    await expect(page.getByText(/El producto se paga en la tienda/)).toBeVisible()
    await expect(page.getByText(/todavía no están aprobadas por Optimus/i)).toBeVisible()
  })

  test('una ruta inexistente muestra la página 404 y permite volver', async ({ page }) => {
    await page.goto('/esta-ruta-no-existe')
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /inicio|volver/i }).first()).toBeVisible()
  })

  test('el logo lleva a la portada', async ({ page }) => {
    await page.goto('/tarifas')
    await page.getByRole('banner').getByRole('link', { name: /optimus envíos — inicio/i }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('el pie de página enlaza a las páginas de servicio', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    for (const [name, url] of [['Tarifas y calculadora', /\/tarifas/], ['Contacto y condiciones', /\/contacto/], ['Cómo comprar', /\/como-comprar/]]) {
      await footer.getByRole('link', { name }).click()
      await expect(page).toHaveURL(url)
      await page.goto('/')
    }
  })
})
