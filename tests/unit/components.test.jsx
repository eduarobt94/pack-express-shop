import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import LoginModal from '../../src/components/auth/LoginModal'
import Button from '../../src/components/ui/Button'
import EmptyState from '../../src/components/ui/EmptyState'
import ProductCard from '../../src/components/ui/ProductCard'
import ShippingCalculator from '../../src/components/ui/ShippingCalculator'
import ThemeToggle from '../../src/components/ui/ThemeToggle'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'
import { ThemeProvider } from '../../src/context/ThemeContext'
import { products } from '../../src/data/products'

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

describe('ShippingCalculator', () => {
  it('USD 100 y 5 kg → pagás USD 65 y el desembolso total es USD 165', async () => {
    render(<ShippingCalculator editableValue />)
    await userEvent.type(screen.getByLabelText(/valor de productos/i), '100')
    await userEvent.type(screen.getByLabelText(/peso estimado/i), '5')
    expect(screen.getByText('$65')).toBeInTheDocument()
    expect(screen.getByText('$165')).toBeInTheDocument()
    expect(screen.getByText(/aduana de Cuba no está incluida/i)).toBeInTheDocument()
  })

  it('sin peso no inventa un total: pide cotización', async () => {
    render(<ShippingCalculator editableValue />)
    await userEvent.type(screen.getByLabelText(/valor de productos/i), '100')
    expect(screen.getByText(/pedí cotización/i)).toBeInTheDocument()
    expect(screen.getByText(/a cotizar/i)).toBeInTheDocument()
    expect(screen.queryByText(/desembolso total/i)).not.toBeInTheDocument()
  })

  it('peso negativo o cero → sigue pidiendo cotización', async () => {
    render(<ShippingCalculator value={100} />)
    const kg = screen.getByLabelText(/peso estimado/i)
    await userEvent.type(kg, '-3')
    expect(screen.getByText(/pedí cotización/i)).toBeInTheDocument()
    await userEvent.clear(kg)
    await userEvent.type(kg, '0')
    expect(screen.getByText(/pedí cotización/i)).toBeInTheDocument()
  })

  it('el valor de un producto viene fijo (solo lectura) cuando no es editable', () => {
    render(<ShippingCalculator value={1099} />)
    expect(screen.getByLabelText(/valor de productos/i)).toHaveAttribute('readonly')
  })
})

describe('Button', () => {
  it('renderiza <a> con href, <Link> con "to" y <button> por omisión', () => {
    render(
      <MemoryRouter>
        <Button href="https://x.test">Externo</Button>
        <Button to="/tarifas">Interno</Button>
        <Button onClick={() => {}}>Acción</Button>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Externo' })).toHaveAttribute('href', 'https://x.test')
    expect(screen.getByRole('link', { name: 'Interno' })).toHaveAttribute('href', '/tarifas')
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument()
  })

  it('respeta disabled y no dispara el click', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Pagar</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Pagar' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('EmptyState / ProductCard', () => {
  it('EmptyState muestra título, descripción y acción', () => {
    render(<EmptyState title="Sin resultados" description="Probá otra búsqueda" action={<button>Reintentar</button>} />)
    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeInTheDocument()
    expect(screen.getByText('Probá otra búsqueda')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('ProductCard enlaza al detalle, muestra el precio y no publica ahorros ni stock', () => {
    const p = products[0]
    render(<MemoryRouter><ProductCard product={p} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveAttribute('href', `/producto/${p.id}`)
    expect(screen.getByText(p.name)).toBeInTheDocument()
    expect(screen.getByText(/comisión y envío por kilo/i)).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/stock|agotado|oferta/i)).not.toBeInTheDocument()
  })

  it('ProductCard de marketplace apunta al detalle con el marketplace', () => {
    render(<MemoryRouter><ProductCard product={{ marketplace: 'amazon', asin: 'B0X', title: 'Cosa', brand: 'Marca', price: 10, available: false }} /></MemoryRouter>)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/producto/B0X?marketplace=amazon')
    expect(screen.getByText(/no disponible/i)).toBeInTheDocument()
  })
})

describe('tema claro/oscuro', () => {
  it('modo claro por defecto, alterna y persiste en localStorage y en <html>', async () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    await userEvent.click(screen.getByRole('button', { name: /activar modo oscuro/i }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('pexs-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /activar modo claro/i })).toBeInTheDocument()
  })

  it('respeta la elección guardada', () => {
    localStorage.setItem('pexs-theme', 'dark')
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})

function Probe() {
  const { user, isAuthenticated, error, logout } = useAuth()
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? user.email : 'anon'}</span>
      <span data-testid="err">{error ?? ''}</span>
      <button onClick={logout}>salir</button>
    </div>
  )
}

function renderLogin(props = {}) {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  render(<AuthProvider><LoginModal open onClose={onClose} onSuccess={onSuccess} {...props} /><Probe /></AuthProvider>)
  return { onClose, onSuccess }
}

const okAuth = { success: true, data: { token: 't.t.t', refresh_token: 'r', user: { id: 1, name: 'Ana', email: 'ana@x.uy' } } }

describe('LoginModal + AuthContext (API simulada con fetch)', () => {
  it('login correcto: guarda sesión, llama onSuccess y cierra', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(200, okAuth))
    const { onClose, onSuccess } = renderLogin()
    await userEvent.type(screen.getByPlaceholderText(/tucorreo@email.com/i), ' ana@x.uy ')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'Clave-Segura-123')
    await userEvent.click(screen.getByRole('button', { name: /^ingresar$/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/auth/login')
    expect(JSON.parse(init.body)).toEqual({ email: 'ana@x.uy', password: 'Clave-Segura-123' }) // el email se recorta
    expect(localStorage.getItem('pkx_token')).toBe('t.t.t')
    expect(screen.getByTestId('auth')).toHaveTextContent('ana@x.uy')
  })

  it('credenciales incorrectas: muestra el error del servidor y no inicia sesión', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(401, { success: false, message: 'Credenciales incorrectas' }))
    const { onClose } = renderLogin()
    await userEvent.type(screen.getByPlaceholderText(/tucorreo@email.com/i), 'ana@x.uy')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'mala-clave-1')
    await userEvent.click(screen.getByRole('button', { name: /^ingresar$/i }))
    expect((await screen.findAllByText('Credenciales incorrectas')).length).toBeGreaterThanOrEqual(1)  // banner + contexto
    expect(onClose).not.toHaveBeenCalled()
    expect(localStorage.getItem('pkx_token')).toBeNull()
    expect(screen.getByTestId('auth')).toHaveTextContent('anon')
  })

  it('error de red: muestra un mensaje y no rompe', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('fetch failed')))
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText(/tucorreo@email.com/i), 'ana@x.uy')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'Clave-Segura-123')
    await userEvent.click(screen.getByRole('button', { name: /^ingresar$/i }))
    await waitFor(() => expect(screen.getByTestId('err').textContent).not.toBe(''))
    expect(screen.getByTestId('auth')).toHaveTextContent('anon')
  })

  it('registro: si las contraseñas no coinciden el botón se bloquea y NO se envía nada al servidor', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(201, okAuth))
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /regístrate gratis/i }))
    await userEvent.type(screen.getByPlaceholderText(/tu nombre completo/i), 'Ana Pérez')
    await userEvent.type(screen.getByPlaceholderText(/tucorreo@email.com/i), 'ana@x.uy')
    await userEvent.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), 'Clave-Segura-123')
    await userEvent.type(screen.getByPlaceholderText(/repite la contraseña/i), 'Otra-Clave-456')
    expect(screen.getByText(/contraseñas no coinciden/i)).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /crear cuenta gratis/i })
    expect(submit).toBeDisabled()
    await userEvent.click(submit)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('registro correcto: envía nombre, email, teléfono y contraseña (sin la confirmación)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(201, okAuth))
    const { onSuccess } = renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /regístrate gratis/i }))
    await userEvent.type(screen.getByPlaceholderText(/tu nombre completo/i), 'Ana Pérez')
    await userEvent.type(screen.getByPlaceholderText(/tucorreo@email.com/i), 'ana@x.uy')
    await userEvent.type(screen.getByPlaceholderText(/\+598 99 123 456/), '+598 99 123 456')
    await userEvent.type(screen.getByPlaceholderText(/mínimo 8 caracteres/i), 'Clave-Segura-123')
    await userEvent.type(screen.getByPlaceholderText(/repite la contraseña/i), 'Clave-Segura-123')
    await userEvent.click(screen.getByRole('button', { name: /crear cuenta gratis/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Ana Pérez', email: 'ana@x.uy', password: 'Clave-Segura-123', phone: '+598 99 123 456' })
  })

  it('accesibilidad: es un diálogo con nombre y cada campo tiene etiqueta asociada', async () => {
    renderLogin()
    expect(screen.getByRole('dialog', { name: /acceder al casillero/i })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password')
    await userEvent.click(screen.getByRole('button', { name: /regístrate gratis/i }))
    for (const label of ['Nombre completo', 'Correo electrónico', 'Teléfono', 'Contraseña', 'Confirmar contraseña']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it('Escape cierra el modal cuando es cerrable y no cuando está bloqueado', async () => {
    const a = renderLogin()
    await userEvent.keyboard('{Escape}')
    expect(a.onClose).toHaveBeenCalled()
    const b = renderLogin({ closeable: false })
    await userEvent.keyboard('{Escape}')
    expect(b.onClose).not.toHaveBeenCalled()
  })

  it('logout limpia el almacenamiento y la sesión', async () => {
    localStorage.setItem('pkx_user', JSON.stringify({ id: 1, name: 'Ana', email: 'ana@x.uy' }))
    localStorage.setItem('pkx_token', 'x')
    localStorage.setItem('pkx_refresh', 'y')
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('auth')).toHaveTextContent('ana@x.uy')
    await userEvent.click(screen.getByRole('button', { name: 'salir' }))
    expect(screen.getByTestId('auth')).toHaveTextContent('anon')
    expect(['pkx_token', 'pkx_refresh', 'pkx_user'].map((k) => localStorage.getItem(k))).toEqual([null, null, null])
  })
})
