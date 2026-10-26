import { describe, expect, it } from 'vitest'
import { addresses, currentUser, orders, payStatusMap, shipStatusMap } from '../../src/data/account'
import { categories, getCategory } from '../../src/data/categories'
import { getProduct, products } from '../../src/data/products'
import { testimonials } from '../../src/data/testimonials'
import { getTracking, trackingData } from '../../src/data/tracking'
import { provincesCuba } from '../../src/lib/shipping'

const provinceCodes = new Set(provincesCuba.map((p) => p.code))

describe('integridad de los datos de demostración (referencias cruzadas)', () => {
  it('productos: ids únicos, categoría existente, precio y peso positivos', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length)
    for (const p of products) {
      expect(getCategory(p.category), `categoría de ${p.id}`).toBeTruthy()
      expect(p.price).toBeGreaterThan(0)
      expect(p.weightKg).toBeGreaterThan(0)
      expect(p.gallery.length).toBeGreaterThan(0)
      expect(p).not.toHaveProperty('stock') // sin stock propio: precios y disponibilidad son de terceros
      expect(p).not.toHaveProperty('compareAt') // sin ahorros publicados sin comparar costos equivalentes
    }
    expect(getProduct('ef-delta-2-max').name).toMatch(/DELTA/)
    expect(getProduct('inexistente')).toBeUndefined()
  })

  it('categorías: las 7 del alcance, con slug único', () => {
    expect(categories).toHaveLength(7)
    expect(new Set(categories.map((c) => c.slug)).size).toBe(7)
  })

  it('destinatarios: provincia válida y teléfono', () => {
    for (const a of addresses) {
      expect(provinceCodes.has(a.province), a.label).toBe(true)
      expect(a.phone).toMatch(/^\+53/)
    }
    expect(addresses.filter((a) => a.isDefault)).toHaveLength(1)
  })

  it('compras: estados definidos, destinatario y provincia válidos, cuentas consistentes', () => {
    expect(new Set(orders.map((o) => o.id)).size).toBe(orders.length)
    for (const o of orders) {
      expect(shipStatusMap[o.shipStatus], `${o.id} estado logístico`).toBeTruthy()
      expect(payStatusMap[o.payStatus], `${o.id} estado de pago`).toBeTruthy()
      expect(provinceCodes.has(o.province)).toBe(true)
      expect(o.id).toContain(o.province) // el código lleva la provincia de destino
      const base = o.items.reduce((s, i) => s + i.price * i.qty, 0)
      expect(o.productValue).toBe(base)
      expect(o.commission).toBe(Math.round(o.productValue * o.rateSnapshot.commissionRate * 100) / 100)
      expect(o.shipping).toBe(Math.round(o.weightKg * o.rateSnapshot.sellRatePerKg * 100) / 100)
      expect(o.optimusTotal).toBeCloseTo(o.commission + o.shipping, 2)
    }
  })

  it('seguimiento: cada código existe como compra y el avance es coherente', () => {
    const orderIds = new Set(orders.map((o) => o.id))
    for (const [id, t] of Object.entries(trackingData)) {
      expect(orderIds.has(id), `${id} sin compra asociada`).toBe(true)
      expect(t.order).toBe(id)
      expect(t.currentStep).toBeGreaterThanOrEqual(0)
      expect(t.currentStep).toBeLessThan(t.steps.length)
      expect(t.steps.slice(0, t.currentStep).every((s) => s.done)).toBe(true) // pasos previos completos
    }
  })

  it('getTracking normaliza mayúsculas/espacios y devuelve undefined si no existe', () => {
    expect(getTracking(' opt-hab-2026-00847 ')).toBeTruthy()
    expect(getTracking('NOPE')).toBeUndefined()
    expect(getTracking(undefined)).toBeUndefined()
  })

  it('cliente de ejemplo con código OPT-UY y testimonios completos', () => {
    expect(currentUser.code).toMatch(/^OPT-UY-\d{6}$/)
    for (const t of testimonials) {
      expect(t.text.length).toBeGreaterThan(20)
      expect(t.rating).toBeGreaterThanOrEqual(1)
      expect(t.rating).toBeLessThanOrEqual(5)
    }
  })
})
