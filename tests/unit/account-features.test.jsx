import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoginModal from '../../src/components/auth/LoginModal'
import RecipientsManager from '../../src/components/account/RecipientsManager'
import PurchaseForm from '../../src/components/locker/PurchaseForm'
import PurchaseList from '../../src/components/locker/PurchaseList'
import { AuthProvider } from '../../src/context/AuthContext'
import ResetPassword from '../../src/pages/ResetPassword'

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const ok = (data, message = 'ok') => json(200, { success: true, message, data })
const TOKEN = 'a'.repeat(64)

afterEach(() => vi.restoreAllMocks())

describe('Recuperación de contraseña', () => {
  it('el modal pide el correo, llama a /auth/forgot-password y muestra un aviso neutro', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => ok(null, 'Si el email existe recibirás instrucciones'))
    render(<AuthProvider><LoginModal open onClose={() => {}} /></AuthProvider>)
    await userEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument() // no se pide contraseña
    await userEvent.type(screen.getByPlaceholderText(/tucorreo@email.com/i), 'ana@x.uy')
    await userEvent.click(screen.getByRole('button', { name: /enviar enlace/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/si el correo existe/i)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/forgot-password$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'ana@x.uy' })
    expect(screen.getByRole('button', { name: /enviar enlace/i })).toBeDisabled() // no se reenvía en cadena
  })

  it('desde la recuperación se puede volver a ingresar', async () => {
    render(<AuthProvider><LoginModal open onClose={() => {}} /></AuthProvider>)
    await userEvent.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))
    await userEvent.click(screen.getByRole('button', { name: /volver a ingresar/i }))
    expect(screen.getByText('Acceder al Casillero')).toBeInTheDocument()
  })

  function renderReset(search) {
    return render(
      <MemoryRouter initialEntries={[`/restablecer${search}`]}>
        <AuthProvider><ResetPassword /></AuthProvider>
      </MemoryRouter>,
    )
  }

  it('la página de restablecer rechaza un token con formato inválido sin llamar a la API', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderReset('?token=xyz')
    expect(screen.getByRole('alert')).toHaveTextContent(/enlace no es válido/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('con token válido envía la contraseña nueva y confirma; no permite contraseñas distintas ni cortas', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => ok(null, 'Contraseña actualizada correctamente'))
    renderReset(`?token=${TOKEN}`)
    const save = screen.getByRole('button', { name: /guardar contraseña/i })
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'corta')
    expect(save).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Contraseña nueva'))
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Nueva-Clave-456')
    await userEvent.type(screen.getByLabelText('Repetí la contraseña'), 'Otra-Clave-111')
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(save).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Repetí la contraseña'))
    await userEvent.type(screen.getByLabelText('Repetí la contraseña'), 'Nueva-Clave-456')
    await userEvent.click(save)
    expect(await screen.findByRole('status')).toHaveTextContent(/se actualizó/i)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: TOKEN, password: 'Nueva-Clave-456' })
  })

  it('si el servidor rechaza el token muestra el error y deja reintentar', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(400, { success: false, message: 'Token inválido o expirado' }))
    renderReset(`?token=${TOKEN}`)
    await userEvent.type(screen.getByLabelText('Contraseña nueva'), 'Nueva-Clave-456')
    await userEvent.type(screen.getByLabelText('Repetí la contraseña'), 'Nueva-Clave-456')
    await userEvent.click(screen.getByRole('button', { name: /guardar contraseña/i }))
    expect(await screen.findByText('Token inválido o expirado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar contraseña/i })).toBeEnabled()
  })
})

const ADDR = { id: 7, label: 'Mamá', recipient: 'Mercedes Pérez', id_doc: '•••••••••832', phone: '+53 5234 5678', province: 'HAB', province_name: 'La Habana', municipality: 'Plaza', street: 'Calle 23 #456', is_default: true }

describe('RecipientsManager', () => {
  it('lista los destinatarios con el documento enmascarado y permite eliminar con confirmación', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      if (init?.method === 'DELETE') return ok(null, 'Dirección eliminada')
      return ok([ADDR])
    })
    render(<RecipientsManager />)
    expect(await screen.findByRole('heading', { name: 'Mamá' })).toBeInTheDocument()
    expect(screen.getByText('•••••••••832')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Mamá' }))
    await userEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => i?.method === 'DELETE' && String(u).endsWith('/user/addresses/7'))).toBe(true))
  })

  it('valida los obligatorios y NO llama a la API hasta que el formulario es correcto', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => ok([]))
    render(<RecipientsManager />)
    await userEvent.click(await screen.findByRole('button', { name: /agregar/i }))
    await userEvent.click(screen.getByRole('button', { name: /guardar destinatario/i }))
    expect(screen.getByText('Ingresá el nombre completo de quien recibe')).toBeInTheDocument()
    expect(screen.getByText('Ingresá un teléfono de contacto')).toBeInTheDocument()
    expect(screen.getByText('Elegí la provincia')).toBeInTheDocument()
    expect(screen.getByText('Ingresá la dirección')).toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
  })

  it('el alta envía solo lo necesario y el documento es opcional', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => (init?.method === 'POST' ? json(201, { success: true, data: ADDR }) : ok([])))
    render(<RecipientsManager />)
    await userEvent.click(await screen.findByRole('button', { name: /agregar/i }))
    await userEvent.type(screen.getByLabelText('Nombre completo de quien recibe'), 'Mercedes Pérez')
    await userEvent.type(screen.getByLabelText('Teléfono en Cuba'), '+53 5234 5678')
    await userEvent.selectOptions(screen.getByLabelText('Provincia'), 'HAB')
    await userEvent.type(screen.getByLabelText('Dirección', { exact: true }), 'Calle 23 #456')
    await userEvent.click(screen.getByRole('button', { name: /guardar destinatario/i }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')[1].body)
    expect(body).toMatchObject({ recipient: 'Mercedes Pérez', phone: '+53 5234 5678', province: 'HAB', street: 'Calle 23 #456', is_default: true })
    expect('id_doc' in body).toBe(false)
  })

  it('al editar, dejar el documento vacío no lo envía (se conserva el guardado)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => ok([ADDR]))
    render(<RecipientsManager />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Mamá' }))
    await userEvent.clear(screen.getByLabelText('Teléfono en Cuba'))
    await userEvent.type(screen.getByLabelText('Teléfono en Cuba'), '+53 5999 0000')
    await userEvent.click(screen.getByRole('button', { name: /guardar destinatario/i }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true))
    const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PUT')
    expect(String(url)).toMatch(/\/user\/addresses\/7$/)
    const body = JSON.parse(init.body)
    expect(body.phone).toBe('+53 5999 0000')
    expect('id_doc' in body).toBe(false)
  })

  it('un error del servidor (p. ej. destinatario con compras) se informa y no rompe la lista', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => (init?.method === 'DELETE' ? json(409, { success: false, message: 'El destinatario tiene compras o envíos asociados y no se puede eliminar' }) : ok([ADDR])))
    render(<RecipientsManager />)
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Mamá' }))
    await userEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/tiene compras o envíos asociados/i)
    expect(screen.getByRole('heading', { name: 'Mamá' })).toBeInTheDocument()
  })
})

const PDF_FILE = () => new File(['%PDF-1.4'], 'factura.pdf', { type: 'application/pdf' })

describe('PurchaseForm', () => {
  function setup(fetchImpl) {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(fetchImpl)
    const onCreated = vi.fn()
    render(<MemoryRouter><PurchaseForm onCreated={onCreated} /></MemoryRouter>)
    return { fetchMock, onCreated }
  }
  const withAddress = (url, init) => (init?.method === 'POST' ? json(201, { success: true, data: { code: 'OPT-HAB-2026-00001' } }) : ok([ADDR]))

  it('sin destinatarios pide cargar uno antes de registrar', async () => {
    setup(() => ok([]))
    expect(await screen.findByText(/necesitás al menos un destinatario/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /agregar destinatario/i })).toHaveAttribute('href', '/cuenta')
  })

  it('calcula el importe por producto (cantidad × precio − descuento) y la comisión del 10 %', async () => {
    setup(withAddress)
    await screen.findByRole('form', { name: 'Registrar una compra' })
    await userEvent.type(screen.getByLabelText('Cantidad'), '{Control>}a{/Control}2')
    await userEvent.type(screen.getByLabelText('Precio unitario (USD)'), '500')
    await userEvent.type(screen.getByLabelText('Descuento (USD)'), '50')
    expect(screen.getByText(/importe del producto/i)).toHaveTextContent('$950')
    const summary = screen.getByRole('region', { name: 'Resumen de costos' })
    expect(within(summary).getByText('$95')).toBeInTheDocument()
    expect(within(summary).getByText(/aduana de Cuba no está incluida/i)).toBeInTheDocument()
    expect(within(summary).getByText('Se calcula con el peso real')).toBeInTheDocument() // no inventa el envío
  })

  it('no envía nada si faltan comprobante, tienda, pedido o aceptación, y lo dice', async () => {
    const { fetchMock } = setup(withAddress)
    await screen.findByRole('form', { name: 'Registrar una compra' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    for (const msg of ['Elegí la tienda', 'Ingresá el número de pedido de la tienda', 'El comprobante es obligatorio', 'Tenés que aceptar las condiciones', 'Cada producto necesita descripción, cantidad y precio unitario']) {
      expect(screen.getByText(msg)).toBeInTheDocument()
    }
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
  })

  it('rechaza un comprobante de tipo no permitido y un descuento mayor al importe', async () => {
    setup(withAddress)
    await screen.findByRole('form', { name: 'Registrar una compra' })
    await userEvent.selectOptions(screen.getByLabelText('Tienda'), 'Amazon')
    await userEvent.type(screen.getByLabelText('Número de pedido de la tienda'), '112-1234567')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Lámpara')
    await userEvent.type(screen.getByLabelText('Precio unitario (USD)'), '20')
    await userEvent.type(screen.getByLabelText('Descuento (USD)'), '30')
    await userEvent.upload(screen.getByLabelText(/comprobante de la compra/i), new File(['x'], 'nota.txt', { type: 'text/plain' }), { applyAccept: false })
    await userEvent.click(screen.getByLabelText(/acepto las condiciones/i))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    expect(screen.getByText('Un descuento supera el importe del producto')).toBeInTheDocument()
    expect(screen.getByText('El comprobante debe ser PDF, JPG, PNG o WEBP')).toBeInTheDocument()
  })

  it('un envío válido manda multipart con productos, impuestos, seguimientos y el comprobante', async () => {
    const { fetchMock, onCreated } = setup(withAddress)
    await screen.findByRole('form', { name: 'Registrar una compra' })
    await userEvent.selectOptions(screen.getByLabelText('Tienda'), 'Amazon')
    await userEvent.type(screen.getByLabelText('Número de pedido de la tienda'), '112-1234567')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Lámpara solar')
    await userEvent.type(screen.getByLabelText('Precio unitario (USD)'), '40')
    await userEvent.type(screen.getByLabelText('Impuestos cobrados por la tienda (USD)'), '3.2')
    await userEvent.type(screen.getByLabelText('Seguimiento 1'), 'TBA123456789')
    await userEvent.upload(screen.getByLabelText(/comprobante de la compra/i), PDF_FILE())
    await userEvent.click(screen.getByLabelText(/acepto las condiciones/i))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    expect(await screen.findByText('¡Compra registrada!')).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')
    expect(String(url)).toMatch(/\/purchases$/)
    const fd = init.body
    expect(fd).toBeInstanceOf(FormData)
    expect(fd.get('store')).toBe('Amazon')
    expect(fd.get('store_order_number')).toBe('112-1234567')
    expect(fd.get('store_taxes')).toBe('3.20')
    expect(fd.get('accept_terms')).toBe('1')
    expect(fd.get('recipient_id')).toBe('7')
    expect(JSON.parse(fd.get('items'))).toEqual([{ description: 'Lámpara solar', qty: 1, unit_price: '40.00' }])
    expect(JSON.parse(fd.get('trackings'))).toEqual([{ tracking_number: 'TBA123456789' }])
    expect(fd.get('receipt').name).toBe('factura.pdf')
  })

  it('muestra el error del servidor (p. ej. pedido repetido) y conserva lo escrito', async () => {
    setup((url, init) => (init?.method === 'POST' ? json(409, { success: false, message: 'Ya registraste esa compra de la tienda' }) : ok([ADDR])))
    await screen.findByRole('form', { name: 'Registrar una compra' })
    await userEvent.selectOptions(screen.getByLabelText('Tienda'), 'Amazon')
    await userEvent.type(screen.getByLabelText('Número de pedido de la tienda'), '112-1234567')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Lámpara solar')
    await userEvent.type(screen.getByLabelText('Precio unitario (USD)'), '40')
    await userEvent.upload(screen.getByLabelText(/comprobante de la compra/i), PDF_FILE())
    await userEvent.click(screen.getByLabelText(/acepto las condiciones/i))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    expect(await screen.findByText('Ya registraste esa compra de la tienda')).toBeInTheDocument()
    expect(screen.getByLabelText('Número de pedido de la tienda')).toHaveValue('112-1234567')
  })
})

describe('PurchaseList', () => {
  const P = { code: 'OPT-HAB-2026-00001', store: 'Amazon', store_order_number: '112-1', purchased_on: '2026-10-20', status: 'partially_received', recipient_label: 'Mamá', products_amount: '950.00', trackings: [{ tracking_number: 'TBA123456789', carrier: 'Amazon Logistics' }] }

  it('muestra estados en español, seguimientos y estados vacíos/de error', () => {
    const { rerender } = render(<PurchaseList purchases={[P]} />)
    expect(screen.getByText('Recibida parcialmente')).toBeInTheDocument()
    expect(screen.getByText(/TBA123456789 · Amazon Logistics/)).toBeInTheDocument()
    rerender(<PurchaseList purchases={[]} />)
    expect(screen.getByText(/todavía no registraste compras/i)).toBeInTheDocument()
    rerender(<PurchaseList purchases={null} error="No autorizado" />)
    expect(screen.getByRole('alert')).toHaveTextContent('No autorizado')
  })

  it('agrega un seguimiento a una compra y avisa para recargar; una compra cancelada no lo permite', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(201, { success: true, data: {} }))
    const onChanged = vi.fn()
    render(<PurchaseList purchases={[P, { ...P, code: 'OPT-HAB-2026-00002', status: 'cancelled', trackings: [] }]} onChanged={onChanged} />)
    expect(screen.getAllByRole('button', { name: /agregar seguimiento a/i })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /agregar seguimiento a OPT-HAB-2026-00001/i }))
    await userEvent.type(screen.getByLabelText('Seguimiento'), '1Z999AA10123456784')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/purchases\/OPT-HAB-2026-00001\/trackings$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ tracking_number: '1Z999AA10123456784' })
  })

  it('un seguimiento demasiado corto no llega a la API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    render(<PurchaseList purchases={[P]} />)
    await userEvent.click(screen.getByRole('button', { name: /agregar seguimiento a/i }))
    await userEvent.type(screen.getByLabelText('Seguimiento'), 'ab')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 4 caracteres/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
