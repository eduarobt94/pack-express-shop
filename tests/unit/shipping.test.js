import { describe, expect, it } from 'vitest'
import { COSTOS_INTERNOS, KG_TO_LB, TARIFAS, internalCost, provincesCuba, quoteShipping } from '../../src/lib/shipping'

describe('quoteShipping — reglas de cobro (comisión 10% + kg × tarifa; aduana aparte)', () => {
  it('caso de aceptación del documento: USD 100 y 5 kg → 10 + 55 = 65', () => {
    const q = quoteShipping({ value: 100, weightKg: 5 })
    expect(q).toMatchObject({ commission: 10, shipping: 55, optimusTotal: 65, grandTotal: 165, needsQuote: false })
  })

  it('la aduana nunca forma parte del total', () => {
    const q = quoteShipping({ value: 1000, weightKg: 10 })
    expect(q.optimusTotal).toBe(q.commission + q.shipping)
    expect(JSON.stringify(q)).not.toMatch(/customs|aduana/i)
  })

  it.each([undefined, null, 0, -1, -0.5, '', 'abc', NaN])('peso inválido (%s) → pide cotización, no inventa un total', (weightKg) => {
    const q = quoteShipping({ value: 100, weightKg })
    expect(q.needsQuote).toBe(true)
    expect(q.shipping).toBeNull()
    expect(q.optimusTotal).toBeNull()
    expect(q.grandTotal).toBeNull()
    expect(q.commission).toBe(10) // la comisión sí se conoce
  })

  it.each([-5, 0, undefined, 'x'])('valor de productos inválido (%s) → comisión 0 y no negativa', (value) => {
    expect(quoteShipping({ value, weightKg: 2 }).commission).toBe(0)
  })

  it('redondea a dos decimales (sin errores de coma flotante)', () => {
    expect(quoteShipping({ value: 0.05, weightKg: 1 }).commission).toBe(0.01) // 0.005 → 0.01
    expect(quoteShipping({ value: 19.99, weightKg: 4.99 }).shipping).toBe(54.89)
    expect(quoteShipping({ value: 33.33, weightKg: 0.1 }).optimusTotal).toBeCloseTo(3.33 + 1.1, 2)
  })

  it('usa la tarifa configurada (no valores fijos escondidos)', () => {
    const q = quoteShipping({ value: 200, weightKg: 3 })
    expect(q.commission).toBe(Math.round(200 * TARIFAS.commissionRate * 100) / 100)
    expect(q.shipping).toBe(Math.round(3 * TARIFAS.sellRatePerKg * 100) / 100)
  })
})

describe('internalCost — costo interno y margen (solo administración)', () => {
  it('ejemplo acordado de 24,5 kg: costo 214,05, venta 269,50, margen 55,45', () => {
    const c = internalCost({ kg: 24.5 })
    expect(c).toMatchObject({ transport: 189.05, packaging: 10, delivery: 15, total: 214.05, perKg: 8.74, sale: 269.5, grossMargin: 55.45 })
  })

  it('no duplica embalaje y entrega: se cuentan una sola vez', () => {
    const c = internalCost({ kg: 10 })
    expect(c.total).toBe(c.transport + COSTOS_INTERNOS.packaging + COSTOS_INTERNOS.delivery)
  })

  it.each([0, -1, NaN])('peso %s → error (no divide por cero)', (kg) => {
    expect(() => internalCost({ kg })).toThrow()
  })

  it('conversión kg → lb', () => {
    expect(24.5 * KG_TO_LB).toBeCloseTo(54.0132, 3)
  })
})

describe('catálogo de provincias de Cuba', () => {
  it('tiene las 16 provincias/municipio especial con códigos únicos de 3 letras', () => {
    expect(provincesCuba).toHaveLength(16)
    const codes = provincesCuba.map((p) => p.code)
    expect(new Set(codes).size).toBe(16)
    expect(codes.every((c) => /^[A-Z]{3}$/.test(c))).toBe(true)
    expect(provincesCuba.find((p) => p.code === 'HAB').name).toBe('La Habana')
  })
})
