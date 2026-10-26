import { describe, expect, it, vi } from 'vitest'
import { formatDate, formatDateTime, formatUSD } from '../../src/lib/format'
import {
  PACKAGE_STATES, CONSOLIDABLE_STATES, createPackage, createPreAlert, createShipmentFromPackages, generateSuiteId,
} from '../../src/lib/locker'
import { cacheClear, cacheGet, cacheSet } from '../../src/lib/marketplaces/cache'
import { getAmazonProduct, searchAmazon } from '../../src/lib/marketplaces/amazonAdapter'
import { createPurchase, generatePurchaseId, purchaseProvinceName } from '../../src/lib/order'
import { safeUrl } from '../../src/lib/safeUrl'
import { TARIFAS } from '../../src/lib/shipping'

describe('format', () => {
  it('formatUSD: enteros sin decimales y fracciones con dos', () => {
    expect(formatUSD(1099)).toBe('$1,099')
    expect(formatUSD(65)).toBe('$65')
    expect(formatUSD(149.89)).toBe('$149.89')
    expect(formatUSD(0.5)).toBe('$0.50')
  })

  it('formatDate / formatDateTime devuelven texto legible y no fallan con ISO válidos', () => {
    expect(formatDate('2026-10-08T14:32:00')).toMatch(/2026/)
    expect(formatDateTime('2026-10-08T14:32:00')).toMatch(/\d{2}:\d{2}/)
  })
})

describe('safeUrl — solo enlaces http(s)', () => {
  it.each(['https://www.amazon.com/dp/B0B2RDFB2L', 'http://example.com/a?b=1'])('acepta %s', (u) => {
    expect(safeUrl(u)).toBeTruthy()
  })

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd', '', 'no es url', undefined, null, '//evil.com'])(
    'rechaza %s', (u) => {
      expect(safeUrl(u)).toBeUndefined()
    })
})

describe('order — compras', () => {
  const recipient = { name: 'Mercedes', province: 'HAB', municipality: 'Plaza', street: 'Calle 23', phone: '+53 5234 5678' }
  const items = [{ id: 'a', name: 'EcoFlow', qty: 2, price: 500 }, { id: 'b', name: 'Cable', qty: 1, price: 19.99 }]

  it('generatePurchaseId: formato OPT-{PROV}-{AÑO}-{SEQ} y correlativo único', () => {
    const a = generatePurchaseId('hab', new Date('2026-10-25'))
    const b = generatePurchaseId('hab', new Date('2026-10-25'))
    expect(a).toMatch(/^OPT-HAB-2026-\d{5}$/)
    expect(Number(b.slice(-5))).toBe(Number(a.slice(-5)) + 1)
    expect(generatePurchaseId(undefined)).toMatch(/^OPT-HAB-/) // provincia por omisión
  })

  it('createPurchase: base de comisión = suma de productos, estado inicial y tarifa congelada', () => {
    const p = createPurchase({ store: 'Amazon', storeOrder: '112-1', recipient, items })
    expect(p.productValue).toBe(1019.99)
    expect(p).toMatchObject({ shipStatus: 'pending_reception', payStatus: 'estimate', weightKg: null })
    expect(p.estimate.needsQuote).toBe(true) // sin peso no hay total
    expect(p.rateSnapshot).toEqual(TARIFAS)
    expect(p.rateSnapshot).not.toBe(TARIFAS) // copia: un cambio posterior de tarifa no altera la compra
    expect(p.id).toMatch(/^OPT-HAB-\d{4}-\d{5}$/)
  })

  it('createPurchase con peso calcula la estimación', () => {
    const p = createPurchase({ store: 'Amazon', storeOrder: '112-2', recipient, items: [{ id: 'x', name: 'x', qty: 1, price: 100 }], weightKg: 5 })
    expect(p.estimate.optimusTotal).toBe(65)
  })

  it('purchaseProvinceName resuelve la provincia y tolera datos faltantes', () => {
    expect(purchaseProvinceName({ recipient: { province: 'SCU' } })).toBe('Santiago de Cuba')
    expect(purchaseProvinceName({ recipient: { province: 'ZZZ' } })).toBe('—')
    expect(purchaseProvinceName({})).toBe('—')
  })
})

describe('locker — paquetes y envíos', () => {
  it('generateSuiteId toma los últimos 6 dígitos y rellena con ceros', () => {
    expect(generateSuiteId('096582')).toBe('OPT-UY-096582')
    expect(generateSuiteId('u-12')).toBe('OPT-UY-000012')
    expect(generateSuiteId('1234567890')).toBe('OPT-UY-567890')
  })

  it('createPackage / createPreAlert aplican valores por omisión seguros', () => {
    const p = createPackage({ trackingNumber: 'T1' })
    expect(p).toMatchObject({ status: 'received', weightKg: 0, declaredValue: 0, shipmentId: null, notes: [] })
    expect(p.id).toMatch(/^WR-2026-\d{5}$/)
    expect(createPreAlert({}).status).toBe('pending')
  })

  it('createShipmentFromPackages: no duplica comisión ni peso (USD 150 y 5 kg → 15 + 55 = 70)', () => {
    const s = createShipmentFromPackages([
      { id: 'WR-1', suiteId: 'OPT-UY-1', weightKg: 2, declaredValue: 100 },
      { id: 'WR-2', suiteId: 'OPT-UY-1', weightKg: 3, declaredValue: 50 },
    ])
    expect(s).toMatchObject({ totalWeightKg: 5, productValue: 150, commission: 15, freight: 55, total: 70, status: 'pending_payment' })
    expect(s.packageIds).toEqual(['WR-1', 'WR-2'])
    expect(s.rateSnapshot).toEqual(TARIFAS)
  })

  it('un envío sin peso cobra solo la comisión y no inventa flete', () => {
    const s = createShipmentFromPackages([{ id: 'WR-3', suiteId: 'S', weightKg: 0, declaredValue: 80 }])
    expect(s.freight).toBe(0)
    expect(s.total).toBe(8)
  })

  it('estados: solo "ready" es consolidable y todos tienen etiqueta', () => {
    expect(CONSOLIDABLE_STATES).toEqual(['ready'])
    for (const meta of Object.values(PACKAGE_STATES)) expect(meta.label).toBeTruthy()
  })
})

describe('caché de marketplaces', () => {
  it('guarda y recupera; expira por TTL', () => {
    vi.useFakeTimers()
    cacheSet('k', { a: 1 }, 1000)
    expect(cacheGet('k')).toEqual({ a: 1 })
    vi.advanceTimersByTime(1001)
    expect(cacheGet('k')).toBeNull()
    expect(localStorage.getItem('pexs:mkt:k')).toBeNull() // la entrada vencida se elimina
    vi.useRealTimers()
  })

  it('tolera JSON corrupto y cacheClear limpia solo su prefijo', () => {
    localStorage.setItem('pexs:mkt:rota', '{no es json')
    expect(cacheGet('rota')).toBeNull()
    cacheSet('amazon:1', 1)
    cacheSet('otra:1', 2)
    localStorage.setItem('ajena', 'x')
    cacheClear('amazon:')
    expect(cacheGet('amazon:1')).toBeNull()
    expect(cacheGet('otra:1')).toBe(2)
    expect(localStorage.getItem('ajena')).toBe('x')
  })

  it('no rompe si localStorage lanza (cuota llena / modo privado)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded') })
    expect(() => cacheSet('k', 1)).not.toThrow()
  })
})

describe('adaptador de Amazon (sin proxy: datos de demostración)', () => {
  it('busca por título/marca sin distinguir mayúsculas y normaliza el contrato', async () => {
    const r = await searchAmazon('ecoflow')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((p) => p.marketplace === 'amazon' && p.currency === 'USD' && p.url.startsWith('https://'))).toBe(true)
    expect(r.every((p) => /ecoflow/i.test(`${p.title} ${p.brand} ${p.description}`))).toBe(true)
  })

  it('sin coincidencias devuelve lista vacía; sin query devuelve todo', async () => {
    expect(await searchAmazon('zzzz-inexistente')).toEqual([])
    expect((await searchAmazon('')).length).toBeGreaterThan(5)
  })

  it('la segunda búsqueda sale de la caché', async () => {
    await searchAmazon('dewalt')
    expect(localStorage.getItem('pexs:mkt:amazon:search:dewalt:1')).toBeTruthy()
  })

  it('getAmazonProduct: existente, inexistente y ASIN vacío', async () => {
    expect((await getAmazonProduct('B0B2RDFB2L')).title).toMatch(/EcoFlow/)
    expect(await getAmazonProduct('NOEXISTE')).toBeNull()
    expect(await getAmazonProduct('')).toBeNull()
  })
})
