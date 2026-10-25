// Modelo del casillero virtual Optimus Envíos.
// Gestiona Packages (paquetes recibidos en EE.UU.) y Shipments (envíos a Cuba con su liquidación).
// Las tarifas salen de shipping.js (comisión + kg × tarifa); aquí no hay motor propio.

import { quoteShipping, TARIFAS } from './shipping'

// ─────────────────────────────────────────────────────────────────────────────
// Suite del usuario
// ─────────────────────────────────────────────────────────────────────────────

export const MIAMI_ADDRESS = {
  street: '5459 NW 72nd AVE',
  city: 'Miami',
  state: 'FL',
  zip: '33166-2759',
  phone: '+1 (305) 456-6247',
}

/**
 * Genera el suiteId de un usuario a partir de su userId.
 * Formato: OPT-UY-{6 dígitos}.
 * @param {string} userId
 * @param {'UY'} country
 * @returns {string}
 */
export function generateSuiteId(userId, country = 'UY') {
  const numeric = userId.replace(/\D/g, '').slice(-6).padStart(6, '0')
  return `OPT-${country}-${numeric}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Estados del paquete
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGE_STATES = {
  received: { label: 'Recibido en EE.UU.', color: '#A8A8A8', icon: 'PackageCheck' },
  no_docs: { label: 'Sin identificar', color: '#F5A524', icon: 'FileWarning' },
  verifying: { label: 'En preparación', color: '#A8A8A8', icon: 'ScanSearch' },
  ready: { label: 'Listo para despacho', color: '#22C55E', icon: 'PackagePlus' },
  shipped: { label: 'Despachado', color: '#E31E24', icon: 'Plane' },
  retained: { label: 'Incidencia', color: '#EF4444', icon: 'AlertTriangle' },
}

/** Estados que el usuario puede seleccionar para consolidar. */
export const CONSOLIDABLE_STATES = ['ready']

// ─────────────────────────────────────────────────────────────────────────────
// Typedefs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PackageDimensions
 * @property {number} lengthCm
 * @property {number} widthCm
 * @property {number} heightCm
 */

/**
 * @typedef {Object} Package
 * @property {string} id              Ej: WR-2026-00001
 * @property {string} suiteId         Suite del usuario
 * @property {string} trackingNumber  Tracking del courier original (USPS/UPS/FedEx/Amazon)
 * @property {string} store           Tienda de origen (Amazon, Walmart…)
 * @property {string} description     Descripción del contenido
 * @property {number} declaredValue   Valor declarado USD
 * @property {number} weightKg        Peso real
 * @property {PackageDimensions|null} dimensions  Dimensiones (informativas; el cobro por volumen está pendiente de definir)
 * @property {string} status          keyof PACKAGE_STATES
 * @property {string} receivedAt      ISO — fecha de llegada al almacén en EE.UU.
 * @property {string|null} photoUrl   URL de foto (null = no solicitada)
 * @property {boolean} photoRequested
 * @property {string|null} shipmentId ID del envío al que pertenece (null si aún en locker)
 * @property {string[]} notes         Notas internas del almacén
 */

/**
 * @typedef {Object} PreAlert
 * @property {string} id
 * @property {string} suiteId
 * @property {string} store
 * @property {string} description
 * @property {number} declaredValue
 * @property {string} trackingNumber
 * @property {number} pieces
 * @property {string} createdAt
 * @property {'pending'|'matched'} status  pending = aún no llegó; matched = ya llegó y se vinculó
 */

/**
 * @typedef {Object} LockerShipment
 * @property {string} id              Ej: SH-2026-00001
 * @property {string} suiteId
 * @property {string[]} packageIds    Paquetes consolidados
 * @property {number} totalWeightKg   Peso facturable en kg (suma de pesos registrados)
 * @property {number} productValue    Suma del valor de los productos (base de la comisión)
 * @property {number} commission      Comisión de gestión USD
 * @property {number} freight         Envío USD (kg × tarifa de venta)
 * @property {number} total           Total a pagar a Optimus en sucursal
 * @property {{ commissionRate: number, sellRatePerKg: number }} rateSnapshot  Tarifa aplicada (no cambia si la tarifa se modifica)
 * @property {'pending_payment'|'paid'|'in_transit'|'delivered'} status
 * @property {string} createdAt
 * @property {string|null} dispatchedAt
 */

// ─────────────────────────────────────────────────────────────────────────────
// Redondeo
// ─────────────────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100

/**
 * Crea un nuevo paquete (recibido en almacén en EE.UU.).
 * @param {Partial<Package>} input
 * @returns {Package}
 */
export function createPackage(input) {
  _pkgSeq += 1
  return {
    id: `WR-2026-${String(_pkgSeq).padStart(5, '0')}`,
    suiteId: input.suiteId || '',
    trackingNumber: input.trackingNumber || '',
    store: input.store || '',
    description: input.description || '',
    declaredValue: input.declaredValue || 0,
    weightKg: input.weightKg || 0,
    dimensions: input.dimensions || null,
    status: input.status || 'received',
    receivedAt: input.receivedAt || new Date().toISOString(),
    photoUrl: input.photoUrl || null,
    photoRequested: input.photoRequested || false,
    shipmentId: null,
    notes: input.notes || [],
  }
}

/**
 * Crea una pre-alerta (el usuario avisa qué compró antes de que llegue).
 * @param {Partial<PreAlert>} input
 * @returns {PreAlert}
 */
export function createPreAlert(input) {
  _alertSeq += 1
  return {
    id: `PA-2026-${String(_alertSeq).padStart(5, '0')}`,
    suiteId: input.suiteId || '',
    store: input.store || '',
    description: input.description || '',
    declaredValue: input.declaredValue || 0,
    trackingNumber: input.trackingNumber || '',
    pieces: input.pieces || 1,
    createdAt: input.createdAt || new Date().toISOString(),
    status: 'pending',
  }
}

/**
 * Crea un envío consolidando N paquetes y emite su liquidación.
 * Cada compra conserva su detalle; la comisión y el peso no se duplican.
 * @param {Package[]} packages  Paquetes a incluir (estado 'ready')
 * @returns {LockerShipment}
 */
export function createShipmentFromPackages(packages) {
  _shipSeq += 1
  const id = `SH-2026-${String(_shipSeq).padStart(5, '0')}`
  const now = new Date().toISOString()

  const totalWeightKg = round2(packages.reduce((s, p) => s + p.weightKg, 0))
  const productValue = round2(packages.reduce((s, p) => s + p.declaredValue, 0))
  const q = quoteShipping({ value: productValue, weightKg: totalWeightKg })

  return {
    id,
    suiteId: packages[0]?.suiteId || '',
    packageIds: packages.map((p) => p.id),
    totalWeightKg,
    productValue,
    commission: q.commission,
    freight: q.shipping ?? 0,
    total: q.optimusTotal ?? q.commission,
    rateSnapshot: { ...TARIFAS },
    status: 'pending_payment',
    createdAt: now,
    dispatchedAt: null,
  }
}
