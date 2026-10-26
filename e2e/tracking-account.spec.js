import { expect, test } from './fixtures'

test.describe('Consulta de una compra', () => {
  test('un código existente muestra el avance y el historial', async ({ page }) => {
    await page.goto('/seguimiento')
    await page.getByLabel('Número de orden').fill('OPT-HAB-2026-00847')
    await page.getByRole('button', { name: /consultar/i }).click()
    await expect(page.getByRole('heading', { name: 'OPT-HAB-2026-00847' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Compra registrada').first()).toBeVisible()
    await expect(page.getByText(/aduana la paga el destinatario/i).first()).toBeVisible()
  })

  test('el código se normaliza (minúsculas y espacios)', async ({ page }) => {
    await page.goto('/seguimiento')
    await page.getByLabel('Número de orden').fill('  opt-hab-2026-00892 ')
    await page.getByRole('button', { name: /consultar/i }).click()
    await expect(page.getByRole('heading', { name: 'OPT-HAB-2026-00892' })).toBeVisible({ timeout: 15_000 })
  })

  test('un código inexistente muestra "no encontramos esa compra" y se puede reintentar', async ({ page }) => {
    await page.goto('/seguimiento')
    await page.getByLabel('Número de orden').fill('OPT-XXX-0000-00000')
    await page.getByRole('button', { name: /consultar/i }).click()
    await expect(page.getByText('No encontramos esa compra')).toBeVisible({ timeout: 15_000 })
    await page.getByLabel('Número de orden').fill('OPT-HAB-2026-00847')
    await page.getByRole('button', { name: /consultar/i }).click()
    await expect(page.getByRole('heading', { name: 'OPT-HAB-2026-00847' })).toBeVisible({ timeout: 15_000 })
  })

  test('la ruta /seguimiento/:codigo abre directamente el resultado', async ({ page }) => {
    await page.goto('/seguimiento/OPT-HAB-2026-00847')
    await expect(page.getByRole('heading', { name: 'OPT-HAB-2026-00847' })).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Mi cuenta (datos de demostración)', () => {
  test('resumen, compras con estado logístico y de pago separados, destinatarios y liquidaciones', async ({ page, isMobile }) => {
    test.skip(isMobile, 'cubierto en escritorio')
    await page.goto('/cuenta')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hola')
    await expect(page.getByText(/Pendiente de pago en sucursal/)).toBeVisible()
    await page.getByRole('button', { name: 'Mis compras' }).click()
    await expect(page.getByText('OPT-HAB-2026-00847').first()).toBeVisible()
    await expect(page.getByText('Despachado').first()).toBeVisible()
    await expect(page.getByText('Pagado').first()).toBeVisible()
    await page.getByRole('button', { name: 'Destinatarios' }).click()
    await expect(page.getByRole('heading', { name: 'Destinatarios en Cuba' })).toBeVisible()
    // sin sesión no se muestran destinatarios de nadie: se pide ingresar
    await expect(page.getByText(/ingresá a tu cuenta para cargar y editar/i)).toBeVisible()
    await page.getByRole('button', { name: /liquidaciones y pagos/i }).click()
    await expect(page.getByText(/no se puede confirmar un pago/i)).toBeVisible()
  })

  test('los importes de una compra respetan 10% + USD por kg', async ({ page, isMobile }) => {
    test.skip(isMobile, 'cubierto en escritorio')
    await page.goto('/cuenta')
    await page.getByRole('button', { name: 'Mis compras' }).click()
    const card = page.locator('div.card-surface', { hasText: 'OPT-HAB-2026-00847' }).first()
    await expect(card.getByText('$109.90')).toBeVisible() // 10% de 1099
    await expect(card.getByText('$275')).toBeVisible() // 25 kg × 11
    await expect(card.getByText('$384.90')).toBeVisible()
  })
})
