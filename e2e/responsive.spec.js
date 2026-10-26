import { expect, test } from './fixtures'

const PAGES = ['/', '/catalogo', '/producto/ef-delta-2-max', '/como-comprar', '/tarifas', '/contacto', '/seguimiento', '/cuenta']

test.describe('Responsive: sin desbordes horizontales y menú móvil operativo', () => {
  for (const [w, h] of [[320, 640], [375, 812], [768, 1024], [1280, 800], [1920, 1080]]) {
    test(`sin scroll horizontal a ${w}×${h}`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'el tamaño lo fija el proyecto móvil; el resto se prueba en escritorio')
      await page.setViewportSize({ width: w, height: h })
      for (const path of PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} desborda ${overflow}px a ${w}px`).toBeLessThanOrEqual(1)
      }
    })
  }

  test('móvil: el menú se abre, navega y se cierra', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil')
    await page.goto('/')
    await page.getByRole('button', { name: 'Menú' }).click()
    await page.getByRole('link', { name: 'Tarifas', exact: true }).first().click()
    await expect(page).toHaveURL(/\/tarifas$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tarifas')
  })

  test('móvil: la consulta de compra está en el primer pantallazo y la barra fija da acceso a Consultar y Calcular', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil')
    await page.goto('/')
    const field = page.getByRole('textbox', { name: 'Consultar una compra' })
    await expect(field).toBeVisible()
    const box = await field.boundingBox()
    expect(box.y).toBeLessThan(page.viewportSize().height) // sin hacer scroll
    const bar = page.getByRole('navigation', { name: 'Acciones rápidas' })
    await expect(bar.getByRole('link', { name: /consultar/i })).toBeVisible()
    await expect(bar.getByRole('link', { name: /calcular/i })).toBeVisible()
    await bar.getByRole('link', { name: /consultar/i }).click()
    await expect(page).toHaveURL(/\/seguimiento$/)
  })

  test('móvil: los botones y enlaces principales tienen un área táctil razonable (≥ 36 px de alto)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil')
    await page.goto('/')
    for (const name of [/crear mi cuenta/i, /ver tiendas/i]) {
      const box = await page.getByRole(name.source.includes('crear mi cuenta') ? 'button' : 'link', { name }).first().boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(36)
    }
  })

  test('móvil: la calculadora se usa con el teclado numérico y muestra el resultado', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil')
    await page.goto('/tarifas')
    await expect(page.getByLabel(/valor de productos/i)).toHaveAttribute('inputmode', 'decimal')
    await page.getByLabel(/valor de productos/i).fill('100')
    await page.getByLabel(/peso estimado/i).fill('5')
    await expect(page.getByText('$65', { exact: true })).toBeVisible()
  })
})
