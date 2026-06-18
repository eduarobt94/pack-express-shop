// Motor de cálculo de envío y aduana — simulado (US → Cuba).
// Tarifas por zona y método. Valores hardcodeados para validar la experiencia.

export const provincesCuba = [
  { code: 'HAB', name: 'La Habana', zone: 'A', etaStd: '12–15', etaExp: '7–9' },
  { code: 'ART', name: 'Artemisa', zone: 'A', etaStd: '13–16', etaExp: '8–10' },
  { code: 'MAY', name: 'Mayabeque', zone: 'A', etaStd: '13–16', etaExp: '8–10' },
  { code: 'MTZ', name: 'Matanzas', zone: 'B', etaStd: '14–17', etaExp: '9–11' },
  { code: 'CFG', name: 'Cienfuegos', zone: 'B', etaStd: '15–18', etaExp: '10–12' },
  { code: 'VCL', name: 'Villa Clara', zone: 'B', etaStd: '15–18', etaExp: '10–12' },
  { code: 'SSP', name: 'Sancti Spíritus', zone: 'C', etaStd: '16–19', etaExp: '11–13' },
  { code: 'CAV', name: 'Ciego de Ávila', zone: 'C', etaStd: '16–20', etaExp: '11–13' },
  { code: 'CMG', name: 'Camagüey', zone: 'C', etaStd: '17–20', etaExp: '12–14' },
  { code: 'LTU', name: 'Las Tunas', zone: 'D', etaStd: '18–21', etaExp: '13–15' },
  { code: 'HOL', name: 'Holguín', zone: 'D', etaStd: '18–22', etaExp: '13–15' },
  { code: 'GRA', name: 'Granma', zone: 'D', etaStd: '19–22', etaExp: '14–16' },
  { code: 'SCU', name: 'Santiago de Cuba', zone: 'D', etaStd: '19–23', etaExp: '14–16' },
  { code: 'GTM', name: 'Guantánamo', zone: 'E', etaStd: '20–24', etaExp: '15–17' },
  { code: 'PRI', name: 'Pinar del Río', zone: 'B', etaStd: '15–18', etaExp: '10–12' },
  { code: 'IJV', name: 'Isla de la Juventud', zone: 'E', etaStd: '21–25', etaExp: '16–18' },
]

// Costo de flete por kg según zona
const zoneRatePerKg = { A: 3.2, B: 3.8, C: 4.4, D: 5.1, E: 6.0 }
// Recargo del método express (multiplicador sobre el flete)
const methodMultiplier = { standard: 1, express: 1.65 }
// Tasa de aduana estimada (% sobre el valor del producto)
const customsRate = 0.12
// Cargo fijo de gestión logística por envío
const handlingFee = 15

export function quoteShipping({ weightKg, value, provinceCode, method = 'standard' }) {
  const province = provincesCuba.find((p) => p.code === provinceCode) || provincesCuba[0]
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
    description: 'Prioridad de despacho y vuelo directo. Llega antes a Cuba.',
    icon: 'Plane',
  },
]
