import { expect, test } from './fixtures'

test.describe('Tiendas y productos', () => {
  test('el catálogo orientativo lista productos de energía con aviso de comisión y envío por kilo', async ({ page }) => {
    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /EcoFlow DELTA 2 Max/ }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/comisión y envío por kilo/i).first()).toBeVisible()
  })

  test('buscar filtra los resultados y limpiar los restablece', async ({ page }) => {
    await page.goto('/catalogo')
    const search = page.getByPlaceholder('Buscar por nombre, marca...')
    await expect(page.getByRole('link', { name: /Anker 757/ }).first()).toBeVisible({ timeout: 15_000 })
    await search.fill('anker')
    await expect(page.getByRole('link', { name: /Anker 757/ }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /EcoFlow DELTA 2 Max/ })).toHaveCount(0)
    await page.getByRole('button', { name: /limpiar búsqueda/i }).click()
    await expect(page.getByRole('link', { name: /EcoFlow DELTA 2 Max/ }).first()).toBeVisible()
  })

  test('una búsqueda sin resultados muestra el estado vacío y permite limpiar filtros', async ({ page }) => {
    await page.goto('/catalogo')
    await page.getByPlaceholder('Buscar por nombre, marca...').fill('zzz-no-existe')
    await expect(page.getByText(/no encontramos productos/i)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /limpiar filtros/i }).click()
    await expect(page.getByRole('link', { name: /EcoFlow DELTA 2 Max/ }).first()).toBeVisible()
  })

  test('ordenar por precio de menor a mayor', async ({ page, isMobile }) => {
    test.skip(isMobile, 'cubierto en escritorio')
    await page.goto('/catalogo')
    await expect(page.getByRole('link', { name: /Anker 757/ }).first()).toBeVisible({ timeout: 15_000 })
    await page.getByLabel('Ordenar').selectOption('price-asc')
    await expect(page.locator('a[href^="/producto/"]')).toHaveCount(4, { timeout: 15_000 }) // espera a que termine la carga simulada
    const prices = await page.locator('a[href^="/producto/"] .font-display.font-bold.text-lg').allTextContents()
    const nums = prices.map((p) => Number(p.replace(/[^0-9.]/g, '')))
    expect(nums.length).toBeGreaterThan(1)
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
  })

  test('el filtro por categoría de la URL es respetado y una categoría sin artículos aprobados queda vacía', async ({ page }) => {
    await page.goto('/catalogo?cat=iluminacion')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Iluminación/i)
    await expect(page.getByText(/no encontramos productos/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Detalle de producto', () => {
  test('muestra precio referencial, aviso de terceros y recordatorio de recepción', async ({ page }) => {
    await page.goto('/producto/ef-delta-2-max')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('EcoFlow DELTA 2 Max')
    await expect(page.getByText(/precio referencial/i)).toBeVisible()
    await expect(page.getByText(/pertenecen a la tienda y pueden cambiar/i)).toBeVisible()
    await expect(page.getByText(/dirección y código de recepción/i)).toBeVisible()
    await expect(page.getByText(/ahorra|agotado/i)).toHaveCount(0)
  })

  test('la calculadora del producto usa el valor fijo y pide el peso', async ({ page }) => {
    await page.goto('/producto/ef-delta-2-max')
    await expect(page.getByLabel(/valor de productos/i)).toHaveAttribute('readonly', '')
    await expect(page.getByText('Pedí cotización', { exact: true })).toBeVisible()
    await page.getByLabel(/peso estimado/i).fill('25')
    await expect(page.getByText('$384.90', { exact: true })).toBeVisible() // 109.90 + 275
  })

  test('un producto inexistente muestra un estado de error con salida', async ({ page }) => {
    await page.goto('/producto/no-existe')
    await expect(page.getByText(/producto no encontrado/i)).toBeVisible()
    await page.getByRole('link', { name: /volver al catálogo/i }).click()
    await expect(page).toHaveURL(/\/catalogo/)
  })
})
