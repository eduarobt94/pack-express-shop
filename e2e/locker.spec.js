import { expect, test } from './fixtures'

test.describe('Mis compras y recepción (casillero)', () => {
  test('un visitante ve la pantalla bloqueada y debe iniciar sesión (el formulario no se puede cerrar)', async ({ page }) => {
    await page.goto('/casillero')
    await expect(page.getByText('Acceder al Casillero')).toBeVisible()
    await expect(page.getByRole('button', { name: /^cerrar$/i })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByText('Acceder al Casillero')).toBeVisible()
  })

  test('con sesión: dirección de recepción, paquetes listos y solicitud de liquidación', async ({ page, newUser, loginAs, isMobile }) => {
    test.skip(isMobile, 'cubierto en escritorio')
    await loginAs(await newUser('lock', 'Carla Casillero'))
    await page.goto('/casillero')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mis compras y recepción')
    await expect(page.getByText(/código de recepción/i).first()).toBeVisible()
    // selecciona un paquete listo y abre la liquidación
    await page.getByText('Listo para despacho').first().click()
    await page.getByRole('button', { name: /solicitar liquidación/i }).first().click()
    await expect(page.getByText('Liquidación estimada')).toBeVisible()
    await expect(page.getByText(/el pago es presencial en la sucursal/i)).toBeVisible()
    await expect(page.getByText(/aduana de Cuba no está incluida/i)).toBeVisible()
    await page.getByRole('button', { name: /^solicitar liquidación$/i }).last().click()
    await expect(page.getByText('¡Liquidación solicitada!')).toBeVisible()
  })

  test('las pestañas cambian el contenido y el formulario de compra valida los campos obligatorios', async ({ page, newUser, loginAs, addAddress, isMobile }) => {
    test.skip(isMobile, 'cubierto en escritorio')
    const u = await newUser('tabs')
    await addAddress(u)
    await loginAs(u)
    await page.goto('/casillero')
    await page.getByRole('button', { name: 'Compras registradas' }).click()
    await expect(page.getByText('Registrar una compra')).toBeVisible()
    await page.getByRole('button', { name: 'Registrar compra' }).click()
    await expect(page.getByText(/ingresá el número de pedido/i)).toBeVisible()
    await expect(page.getByText('Elegí la tienda', { exact: true })).toBeVisible()
    await expect(page.getByText('El comprobante es obligatorio')).toBeVisible()
    await expect(page.getByText(/tenés que aceptar las condiciones/i)).toBeVisible()
  })
})
