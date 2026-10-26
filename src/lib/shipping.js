// Motor de tarifas — Optimus Envíos (compras en EE.UU. → entrega en Cuba).
//
// El cliente paga el producto en la tienda. A Optimus le paga:
//   comisión (10% del valor de los productos) + envío (kg × tarifa de venta por kg).
// La aduana de Cuba la paga el destinatario al recibir y NUNCA se suma al total.
//
// PENDIENTE DE OPTIMUS: los valores de TARIFAS son de referencia (USD 11/kg es un
// ejemplo comercial, no un precio definitivo). Peso mínimo, redondeo, fracciones,
// volumen y cargos por batería también están por definir.

export const TARIFAS = {
  commissionRate: 0.1, // sobre la suma del valor de los productos
  sellRatePerKg: 11, // USD por kg — tarifa de venta (referencial)
}

// Parámetros internos de costo (solo administración — nunca mostrar al cliente).
export const COSTOS_INTERNOS = {
  transportPerLb: 3.5,
  packaging: 10,
  delivery: 15,
}

export const KG_TO_LB = 2.20462262

export const provincesCuba = [
  { code: 'PRI', name: 'Pinar del Río' },
  { code: 'ART', name: 'Artemisa' },
  { code: 'HAB', name: 'La Habana' },
  { code: 'MAY', name: 'Mayabeque' },
  { code: 'MTZ', name: 'Matanzas' },
  { code: 'CFG', name: 'Cienfuegos' },
  { code: 'VCL', name: 'Villa Clara' },
  { code: 'SSP', name: 'Sancti Spíritus' },
  { code: 'CAV', name: 'Ciego de Ávila' },
  { code: 'CMG', name: 'Camagüey' },
  { code: 'LTU', name: 'Las Tunas' },
  { code: 'HOL', name: 'Holguín' },
  { code: 'GRA', name: 'Granma' },
  { code: 'SCU', name: 'Santiago de Cuba' },
  { code: 'GTM', name: 'Guantánamo' },
  { code: 'IJV', name: 'Isla de la Juventud' },
]

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Cotización para el cliente.
 * Si no hay un peso válido no inventa un total: devuelve needsQuote.
 * @param {{ value: number, weightKg?: number|null }} input
 */
export function quoteShipping({ value, weightKg }) {
  const productValue = Number(value) > 0 ? Number(value) : 0
  const kg = Number(weightKg)
  const commission = round2(productValue * TARIFAS.commissionRate)

  if (!(kg > 0)) {
    return { productValue, commission, weightKg: null, shipping: null, optimusTotal: null, grandTotal: null, needsQuote: true }
  }

  const shipping = round2(kg * TARIFAS.sellRatePerKg)
  const optimusTotal = round2(commission + shipping)
  return {
    productValue,
    commission,
    weightKg: kg,
    shipping,
    optimusTotal,
    grandTotal: round2(productValue + optimusTotal), // tienda + Optimus; aduana aparte
    needsQuote: false,
  }
}

/**
 * Costo interno del transporte (administración). El costo completo se divide
 * entre los kilos y sobre ese costo por kg se define el margen.
 * @param {{ kg: number, packaging?: number, delivery?: number, otherCharges?: number }} input
 */
export function internalCost({
  kg,
  packaging = COSTOS_INTERNOS.packaging,
  delivery = COSTOS_INTERNOS.delivery,
  otherCharges = 0,
}) {
  if (!(kg > 0)) throw new Error('El peso debe ser mayor que cero')
  const transport = round2(kg * KG_TO_LB * COSTOS_INTERNOS.transportPerLb)
  const total = round2(transport + packaging + delivery + otherCharges)
  const perKg = round2(total / kg)
  const sale = round2(kg * TARIFAS.sellRatePerKg)
  return { transport, packaging, delivery, total, perKg, sale, grossMargin: round2(sale - total) }
}
