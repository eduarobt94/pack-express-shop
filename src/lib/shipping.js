// Motor de cálculo de envío e impuestos — simulado (US → Uruguay).
// Tarifas y plazos son PLACEHOLDERS: validar con la operación de Optimus Envíos.
// Tarifas por zona y método. Valores hardcodeados para validar la experiencia.

export const departmentsUY = [
  { code: 'MVD', name: 'Montevideo', zone: 'A', etaStd: '7–9', etaExp: '4–5' },
  { code: 'CAN', name: 'Canelones', zone: 'A', etaStd: '7–10', etaExp: '4–6' },
  { code: 'SJO', name: 'San José', zone: 'B', etaStd: '8–10', etaExp: '5–6' },
  { code: 'FLO', name: 'Florida', zone: 'B', etaStd: '8–11', etaExp: '5–6' },
  { code: 'MAL', name: 'Maldonado', zone: 'B', etaStd: '8–11', etaExp: '5–7' },
  { code: 'COL', name: 'Colonia', zone: 'B', etaStd: '8–11', etaExp: '5–7' },
  { code: 'FLS', name: 'Flores', zone: 'C', etaStd: '9–12', etaExp: '6–7' },
  { code: 'SOR', name: 'Soriano', zone: 'C', etaStd: '9–12', etaExp: '6–7' },
  { code: 'LAV', name: 'Lavalleja', zone: 'C', etaStd: '9–12', etaExp: '6–7' },
  { code: 'ROC', name: 'Rocha', zone: 'C', etaStd: '9–12', etaExp: '6–8' },
  { code: 'DUR', name: 'Durazno', zone: 'C', etaStd: '9–12', etaExp: '6–8' },
  { code: 'TYT', name: 'Treinta y Tres', zone: 'D', etaStd: '10–13', etaExp: '7–8' },
  { code: 'CLA', name: 'Cerro Largo', zone: 'D', etaStd: '10–13', etaExp: '7–8' },
  { code: 'RNG', name: 'Río Negro', zone: 'D', etaStd: '10–13', etaExp: '7–8' },
  { code: 'PAY', name: 'Paysandú', zone: 'D', etaStd: '10–13', etaExp: '7–9' },
  { code: 'TAC', name: 'Tacuarembó', zone: 'D', etaStd: '10–14', etaExp: '7–9' },
  { code: 'RIV', name: 'Rivera', zone: 'D', etaStd: '10–14', etaExp: '7–9' },
  { code: 'SAL', name: 'Salto', zone: 'E', etaStd: '11–14', etaExp: '8–10' },
  { code: 'ART', name: 'Artigas', zone: 'E', etaStd: '11–15', etaExp: '8–10' },
]

// Costo de flete por kg según zona
const zoneRatePerKg = { A: 2.8, B: 3.2, C: 3.6, D: 4.0, E: 4.4 }
// Recargo del método express (multiplicador sobre el flete)
const methodMultiplier = { standard: 1, express: 1.65 }
// Tasa de impuestos de importación estimada (% sobre el valor del producto)
const customsRate = 0.12
// Cargo fijo de gestión logística por envío
const handlingFee = 15

export function quoteShipping({ weightKg, value, provinceCode, method = 'standard' }) {
  const province = departmentsUY.find((p) => p.code === provinceCode) || departmentsUY[0]
  const ratePerKg = zoneRatePerKg[province.zone]
  const freight = Math.round(weightKg * ratePerKg * methodMultiplier[method] * 100) / 100
  const customs = Math.round(value * customsRate * 100) / 100
  const handling = handlingFee
  const total = Math.round((freight + customs + handling) * 100) / 100
  return {
    province,
    freight,
    customs,
    handling,
    total,
    eta: method === 'express' ? province.etaExp : province.etaStd,
  }
}

export const shippingMethods = [
  {
    id: 'standard',
    name: 'Estándar',
    description: 'La opción más económica. Consolidación semanal desde Miami.',
    icon: 'Ship',
  },
  {
    id: 'express',
    name: 'Express',
    description: 'Prioridad de despacho y vuelo prioritario. Llega antes a Uruguay.',
    icon: 'Plane',
  },
]
