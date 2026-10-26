import { API, PASSWORD, expect, resetTokenFor, test } from './fixtures'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')

test.describe('Recuperación de contraseña (UI + API + correo de pruebas)', () => {
  test('pedir el enlace, abrirlo y definir una contraseña nueva; la anterior deja de servir', async ({ page, request, newUser, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    const u = await newUser('rec')
    await page.goto('/')
    await page.getByRole('button', { name: /^ingresar$/i }).first().click()
    await page.getByRole('button', { name: /olvidaste tu contraseña/i }).click()
    await expect(page.getByText('Recuperar contraseña')).toBeVisible()
    await page.getByPlaceholder('tucorreo@email.com').fill(u.email)
    await page.getByRole('button', { name: /enviar enlace/i }).click()
    await expect(page.getByRole('status')).toContainText(/si el correo existe/i)

    const token = await resetTokenFor(u.email)
    await page.goto(`/restablecer?token=${token}`)
    await page.getByLabel('Contraseña nueva').fill('Nueva-Clave-456')
    await page.getByLabel('Repetí la contraseña').fill('Otra-Distinta-1')
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()
    await expect(page.getByRole('button', { name: /guardar contraseña/i })).toBeDisabled()
    await page.getByLabel('Repetí la contraseña').fill('Nueva-Clave-456')
    await page.getByRole('button', { name: /guardar contraseña/i }).click()
    await expect(page.getByRole('status')).toContainText(/tu contraseña se actualizó/i)

    expect((await request.post(`${API}/auth/login`, { data: { email: u.email, password: PASSWORD } })).status()).toBe(401)
    expect((await request.post(`${API}/auth/login`, { data: { email: u.email, password: 'Nueva-Clave-456' } })).status()).toBe(200)
    // el mismo enlace no se puede reutilizar
    expect((await request.post(`${API}/auth/reset-password`, { data: { token, password: 'Tercera-Clave-789' } })).status()).toBe(400)
  })

  test('un correo inexistente recibe la misma respuesta (no se revela qué cuentas existen)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    await page.goto('/')
    await page.getByRole('button', { name: /^ingresar$/i }).first().click()
    await page.getByRole('button', { name: /olvidaste tu contraseña/i }).click()
    await page.getByPlaceholder('tucorreo@email.com').fill('nadie.existe@e2e.uy')
    await page.getByRole('button', { name: /enviar enlace/i }).click()
    await expect(page.getByRole('status')).toContainText(/si el correo existe/i)
  })

  test('un enlace con token inválido muestra un aviso y permite pedir otro', async ({ page }) => {
    await page.goto('/restablecer?token=no-valido')
    await expect(page.getByRole('alert')).toContainText(/este enlace no es válido/i)
    await expect(page.getByRole('button', { name: /pedir un enlace nuevo/i })).toBeVisible()
  })
})

test.describe('Destinatarios en Cuba (alta, edición y baja)', () => {
  test('agregar, editar y eliminar un destinatario; el documento se muestra enmascarado', async ({ page, newUser, loginAs, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    await loginAs(await newUser('dest'))
    await page.goto('/cuenta')
    await page.getByRole('button', { name: 'Destinatarios' }).click()
    await expect(page.getByText(/todavía no cargaste destinatarios/i)).toBeVisible()

    await page.getByRole('button', { name: /agregar/i }).click()
    await page.getByRole('button', { name: /guardar destinatario/i }).click()
    await expect(page.getByText('Ingresá el nombre completo de quien recibe')).toBeVisible()
    await expect(page.getByText('Elegí la provincia', { exact: true })).toBeVisible()

    await page.getByLabel('Nombre completo de quien recibe').fill('Mercedes Pérez')
    await page.getByLabel('Teléfono en Cuba').fill('+53 5234 5678')
    await page.getByLabel('Provincia').selectOption('HAB')
    await page.getByLabel('Dirección', { exact: true }).fill('Calle 23 #456 e/ 12 y 14')
    await page.getByLabel('Nombre para identificarlo (opcional)').fill('Mamá')
    await page.getByLabel(/documento de identidad/i).fill('54091205832')
    await page.getByRole('button', { name: /guardar destinatario/i }).click()
    await expect(page.getByText('Destinatario agregado')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mamá' })).toBeVisible()
    await expect(page.getByText('54091205832')).toHaveCount(0) // nunca se muestra completo
    await expect(page.getByText('••••••••832')).toBeVisible()

    await page.getByRole('button', { name: 'Editar Mamá' }).click()
    await page.getByLabel('Teléfono en Cuba').fill('+53 5999 0000')
    await page.getByRole('button', { name: /guardar destinatario/i }).click()
    await expect(page.getByText('Cambios guardados')).toBeVisible()
    await expect(page.getByText('+53 5999 0000')).toBeVisible()
    await expect(page.getByText('••••••••832')).toBeVisible() // el documento guardado se conserva si se deja vacío

    await page.getByRole('button', { name: 'Eliminar Mamá' }).click()
    await page.getByRole('button', { name: /sí, eliminar/i }).click()
    await expect(page.getByText('Destinatario eliminado')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mamá' })).toHaveCount(0)
  })

  test('sin sesión se pide ingresar y no se muestran destinatarios de nadie', async ({ page, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    await page.goto('/cuenta')
    await page.getByRole('button', { name: 'Destinatarios' }).click()
    await expect(page.getByText(/ingresá a tu cuenta para cargar y editar/i)).toBeVisible()
  })
})

test.describe('Registro de compra completo', () => {
  test('registra una compra con productos, descuentos, impuestos, seguimientos y comprobante; luego suma otro seguimiento', async ({ page, request, newUser, loginAs, addAddress, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    const u = await newUser('buy')
    await addAddress(u)
    await loginAs(u)
    await page.goto('/casillero')
    await page.getByRole('button', { name: 'Compras registradas' }).click()

    const form = page.getByRole('form', { name: 'Registrar una compra' })
    await form.getByLabel('Tienda', { exact: true }).selectOption('Amazon')
    await form.getByLabel('Número de pedido de la tienda').fill('112-0000001-2223334')
    await form.getByLabel('Descripción').fill('Estación de energía portátil')
    await form.getByLabel('Modelo (opcional)').fill('DELTA 2')
    await form.getByLabel('Enlace del producto (opcional)').fill('https://www.amazon.com/dp/B0B2RDFB2L')
    await form.getByLabel('Cantidad').fill('2')
    await form.getByLabel('Precio unitario (USD)').fill('500')
    await form.getByLabel('Descuento (USD)').fill('50')
    // 2 × 500 − 50 = 950; comisión 10 % = 95
    await expect(form.getByText('Importe del producto:')).toContainText('$950')
    await expect(form.getByRole('region', { name: 'Resumen de costos' })).toContainText('$95')
    await expect(form.getByRole('region', { name: 'Resumen de costos' })).toContainText(/aduana de Cuba no está incluida/i)
    await form.getByLabel('Impuestos cobrados por la tienda (USD)').fill('12.50')
    await form.getByLabel('Envío interno de la tienda en EE.UU. (USD)').fill('0')
    await form.getByLabel('Seguimiento 1').fill('TBA123456789')
    await form.getByLabel('Transportista').selectOption('Amazon Logistics')
    await form.getByLabel('Observaciones (opcional)').fill('Entregar con cuidado')
    await form.getByLabel(/comprobante de la compra/i).setInputFiles({ name: 'factura.pdf', mimeType: 'application/pdf', buffer: PDF })
    await form.getByLabel(/acepto las condiciones/i).check()
    await form.getByRole('button', { name: 'Registrar compra' }).click()

    await expect(page.getByText('¡Compra registrada!')).toBeVisible()
    const code = (await page.getByText(/^OPT-HAB-\d{4}-\d{5}$/).first().textContent())?.trim()
    expect(code).toMatch(/^OPT-HAB-/)
    const item = page.getByRole('listitem').filter({ hasText: code })
    await expect(item).toContainText('Amazon · pedido 112-0000001-2223334')
    await expect(item).toContainText('TBA123456789')

    // si la tienda divide el envío: se agrega otro seguimiento
    await item.getByRole('button', { name: `Agregar seguimiento a ${code}` }).click()
    await item.getByLabel('Seguimiento', { exact: true }).fill('1Z999AA10123456784')
    await item.getByRole('button', { name: 'Guardar' }).click()
    await expect(item).toContainText('1Z999AA10123456784')

    // lo guardado en el servidor coincide
    const res = await request.get(`${API}/purchases/${code}`, { headers: { Authorization: `Bearer ${u.token}` } })
    const data = (await res.json()).data
    expect(data.trackings.map((t) => t.tracking_number)).toEqual(['TBA123456789', '1Z999AA10123456784'])
    expect(Number(data.items[0].line_amount)).toBe(950)
    expect(Number(data.store_taxes)).toBe(12.5)
    expect(data.notes).toBe('Entregar con cuidado')
  })

  test('valida comprobante, descuentos y seguimientos antes de enviar y no registra nada', async ({ page, request, newUser, loginAs, addAddress, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    const u = await newUser('buyv')
    await addAddress(u)
    await loginAs(u)
    await page.goto('/casillero')
    await page.getByRole('button', { name: 'Compras registradas' }).click()
    const form = page.getByRole('form', { name: 'Registrar una compra' })
    await form.getByLabel('Tienda', { exact: true }).selectOption('Walmart')
    await form.getByLabel('Número de pedido de la tienda').fill('W-123456')
    await form.getByLabel('Descripción').fill('Ventilador recargable')
    await form.getByLabel('Precio unitario (USD)').fill('30')
    await form.getByLabel('Descuento (USD)').fill('99') // mayor que el importe
    await form.getByLabel('Seguimiento 1').fill('ab') // demasiado corto
    await form.getByLabel(/comprobante de la compra/i).setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') })
    await form.getByRole('button', { name: 'Registrar compra' }).click()
    await expect(form.getByText('Un descuento supera el importe del producto')).toBeVisible()
    await expect(form.getByText('Cada seguimiento necesita al menos 4 caracteres')).toBeVisible()
    await expect(form.getByText('El comprobante debe ser PDF, JPG, PNG o WEBP')).toBeVisible()
    await expect(form.getByText('Tenés que aceptar las condiciones')).toBeVisible()
    const list = await request.get(`${API}/purchases`, { headers: { Authorization: `Bearer ${u.token}` } })
    expect((await list.json()).data).toHaveLength(0)
  })

  test('sin destinatarios se pide cargar uno antes de registrar una compra', async ({ page, newUser, loginAs, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    await loginAs(await newUser('buy0'))
    await page.goto('/casillero')
    await page.getByRole('button', { name: 'Compras registradas' }).click()
    await expect(page.getByText(/necesitás al menos un destinatario/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /agregar destinatario/i })).toBeVisible()
  })

  test('una compra no se registra dos veces con el mismo pedido de la tienda', async ({ page, newUser, loginAs, addAddress, request, isMobile }) => {
    test.skip(isMobile, 'flujo cubierto en escritorio')
    const u = await newUser('dup')
    await addAddress(u)
    await loginAs(u)
    const body = async (order) => ({
      multipart: {
        recipient_id: String((await (await request.get(`${API}/user/addresses`, { headers: { Authorization: `Bearer ${u.token}` } })).json()).data[0].id),
        store: 'Amazon', store_order_number: order, purchased_on: new Date().toISOString().slice(0, 10), accept_terms: '1',
        items: JSON.stringify([{ description: 'Cargador solar', qty: 1, unit_price: '25.00' }]),
        receipt: { name: 'f.pdf', mimeType: 'application/pdf', buffer: PDF },
      },
      headers: { Authorization: `Bearer ${u.token}` },
    })
    expect((await request.post(`${API}/purchases`, await body('DUP-123456'))).status()).toBe(201)
    expect((await request.post(`${API}/purchases`, await body('DUP-123456'))).status()).toBe(409)
    await page.goto('/casillero')
    await page.getByRole('button', { name: 'Compras registradas' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'DUP-123456' })).toHaveCount(1)
  })
})
