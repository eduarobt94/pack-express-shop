import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Badge from '../../src/components/ui/Badge'
import MarketplaceBadge from '../../src/components/ui/MarketplaceBadge'
import { PriceNotice, ReceptionReminder } from '../../src/components/ui/Notices'
import { ProductCardSkeleton, Skeleton } from '../../src/components/ui/Skeleton'
import Stars from '../../src/components/ui/Stars'
import { api } from '../../src/lib/api'
import { readable } from '../../src/lib/contrast'

const res = (status, body) => Promise.resolve(new Response(body === undefined ? 'no es json' : JSON.stringify(body), { status }))

describe('api (cliente HTTP)', () => {
  it('envía el token guardado como Bearer y el cuerpo como JSON', async () => {
    localStorage.setItem('pkx_token', 'tok123')
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => res(200, { success: true, data: 1 }))
    await api.post('/purchases', { a: 1 })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('/api/v1/purchases')
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}' })
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok123', 'Content-Type': 'application/json' })
  })

  it('sin sesión no envía Authorization', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => res(200, { success: true }))
    await api.get('/tariffs/current')
    expect(f.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('upload no fuerza Content-Type (lo fija el navegador con el boundary)', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => res(201, { success: true }))
    const fd = new FormData()
    fd.append('receipt', new Blob(['%PDF-'], { type: 'application/pdf' }), 'f.pdf')
    await api.upload('/purchases', fd)
    expect(f.mock.calls[0][1].headers['Content-Type']).toBeUndefined()
    expect(f.mock.calls[0][1].body).toBe(fd)
  })

  it('un error HTTP lanza Error con status y errores por campo', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => res(422, { success: false, message: 'Datos inválidos', errors: { email: ['email inválido'] } }))
    await expect(api.put('/user', {})).rejects.toMatchObject({ message: 'Datos inválidos', status: 422, errors: { email: ['email inválido'] } })
  })

  it('una respuesta que no es JSON se trata como error de red', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => res(502, undefined))
    await expect(api.delete('/user/addresses/1')).rejects.toMatchObject({ message: 'Error de red', status: 502 })
  })

  it('GET y PUT usan el verbo correcto', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => res(200, { success: true }))
    await api.get('/user')
    await api.put('/user', { name: 'Ana' })
    expect(f.mock.calls.map((c) => c[1].method)).toEqual(['GET', 'PUT'])
  })
})

describe('contraste: readable()', () => {
  it('traduce los colores de marca a tokens legibles y respeta cualquier otro valor', () => {
    expect(readable('#e31e24')).toBe('var(--brand-text)')
    expect(readable('#22C55E')).toBe('var(--ok-text)')
    expect(readable('#A8A8A8')).toBe('var(--fg-3)')
    expect(readable('#123456')).toBe('#123456')
    expect(readable('var(--sec)')).toBe('var(--sec)')
    expect(readable(undefined)).toBeUndefined()
    expect(readable(3)).toBe(3)
  })
})

describe('componentes de presentación', () => {
  it('Badge: variantes conocidas y colores personalizados', () => {
    render(<><Badge>Más vendido</Badge><Badge color="#22C55E">Listo</Badge><Badge>Otro</Badge></>)
    expect(screen.getByText('Más vendido')).toBeInTheDocument()
    expect(screen.getByText('Listo')).toHaveStyle({ color: 'var(--ok-text)' })
    expect(screen.getByText('Otro')).toBeInTheDocument()
  })

  it('Stars: etiqueta accesible, cinco estrellas y valor opcional', () => {
    const { container } = render(<Stars rating={4.4} showValue />)
    expect(screen.getByLabelText('Calificación 4.4 de 5')).toBeInTheDocument()
    expect(container.querySelectorAll('svg')).toHaveLength(5)
    expect(screen.getByText('4.4')).toBeInTheDocument()
  })

  it('Skeleton se oculta a las tecnologías de apoyo', () => {
    const { container } = render(<><Skeleton className="h-3" /><ProductCardSkeleton /></>)
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(3)
  })

  it('MarketplaceBadge: muestra la tienda y no renderiza nada si es desconocida', () => {
    const { container, rerender } = render(<MarketplaceBadge marketplace="amazon" />)
    expect(container).toHaveTextContent(/amazon/i)
    rerender(<MarketplaceBadge marketplace="inexistente" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Notices: aviso de precios de terceros y recordatorio de recepción con enlace al registro', () => {
    render(<MemoryRouter><PriceNotice /><ReceptionReminder /></MemoryRouter>)
    expect(screen.getByText(/pertenecen a la tienda y pueden cambiar/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /registrá la compra/i })).toHaveAttribute('href', '/casillero')
  })
})
