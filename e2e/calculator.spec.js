import { expect, test } from './fixtures'

test.describe('Tarifas y calculadora', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/tarifas') })

  test('USD 100 y 5 kg → pagás USD 65 a Optimus (caso de aceptación)', async ({ page }) => {
    await page.getByLabel(/valor de productos/i).fill('100')
    await page.getByLabel(/peso estimado/i).fill('5')
    await expect(page.getByText('$65', { exact: true })).toBeVisible()
    await expect(page.getByText('$165', { exact: true })).toBeVisible() // desembolso total (tienda + Optimus)
    await expect(page.getByText(/aduana de Cuba no está incluida/i).first()).toBeVisible()
  })

  test('sin peso no se inventa un total: pide cotización', async ({ page }) => {
    await page.getByLabel(/valor de productos/i).fill('100')
    await expect(page.getByText('Pedí cotización')).toBeVisible()
    await expect(page.getByText(/desembolso total/i)).toHaveCount(0)
  })

  // (los campos numéricos no admiten letras: el navegador las descarta antes de llegar a la aplicación)
  for (const bad of ['-3', '0', '-0.5']) {
    test(`peso inválido "${bad}" no produce un total`, async ({ page }) => {
      await page.getByLabel(/valor de productos/i).fill('100')
      await page.getByLabel(/peso estimado/i).fill(bad)
      await expect(page.getByText('Pedí cotización')).toBeVisible()
    })
  }

  test('el resultado se actualiza al cambiar los datos', async ({ page }) => {
    await page.getByLabel(/valor de productos/i).fill('950')
    await page.getByLabel(/peso estimado/i).fill('10')
    await expect(page.getByText('$205', { exact: true })).toBeVisible() // 95 + 110
    await page.getByLabel(/peso estimado/i).fill('20')
    await expect(page.getByText('$315', { exact: true })).toBeVisible() // 95 + 220
  })

  test('la tarifa mostrada es la de referencia y está marcada como tal', async ({ page }) => {
    await expect(page.getByText(/tarifa de referencia, no es un precio definitivo/i)).toBeVisible()
  })
})
