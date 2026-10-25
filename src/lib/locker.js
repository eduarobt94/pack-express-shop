// Modelo del casillero virtual Optimus Envíos.
// Gestiona Packages (paquetes recibidos en Miami) y Shipments (envíos solicitados).
// Motor de tarifas por peso volumétrico — independiente de shipping.js (no lo modifica).

import { departmentsUY } from './shipping'

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
  received: { label: 'Recibido en Miami', color: '#A8A8A8', icon: 'PackageCheck' },
  no_docs: { label: 'Sin documentación', color: '#F5A524', icon: 'FileWarning' },
  verifying: { label: 'En verificación', color: '#A855F7', icon: 'ScanSearch' },
  ready: { label: 'Listo para enviar', color: '#22C55E', icon: 'PackagePlus' },
  shipped: { label: 'Enviado', color: '#E31E24', icon: 'Plane' },
  retained: { label: 'Retenido en Miami', color: '#EF4444', icon: 'AlertTriangle' },
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
 * @property {PackageDimensions|null} dimensions  Dimensiones (para peso volumétrico)
 * @property {string} status          keyof PACKAGE_STATES
 * @property {string} receivedAt      ISO — fecha de llegada al almacén Miami
 * @property {string|null} photoUrl   URL de foto (null = no solicitada)
 * @property {boolean} photoRequested
 * @property {boolean} insured
 * @property {number} insuranceCost   USD (0 si no asegurado)
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
 * @property {number} totalWeightKg   Suma de pesos reales
 * @property {number} volumetricWeightKg  Peso cobrable (max entre real y volumétrico)
 * @property {number} freight         Flete en USD
 * @property {number} handling        Manejo documentario USD
 * @property {number} insurance       Seguro USD (0 si no aplica)
 * @property {number} total           Total a pagar
 * @property {'pending_payment'|'paid'|'in_transit'|'delivered'} status
 * @property {string} createdAt
 * @property {string|null} dispatchedAt
 */

// ─────────────────────────────────────────────────────────────────────────────
// Motor de tarifas por peso (tramos AeroBox-style)
// ─────────────────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100

/** Tarifa fija para paquetes pequeños (≤500g y ≤600g). */
const SMALL_PARCEL_RATE = { upTo500g: 11.99, upTo600g: 15.5 }

/** Tramos de tarifa por kg (>600g). */
const WEIGHT_TIERS = [
  { maxKg: 5, ratePerKg: 23.5 },
  { maxKg: 10, ratePerKg: 20.5 },
  { maxKg: 20, ratePerKg: 17.5 },
]

/** Cargo fijo de manejo documentario por envío consolidado. */
export const HANDLING_FEE = 5

/** Días de almacenamiento gratuito en Miami. */
export const FREE_STORAGE_DAYS = 75

/** Costo por 15 días extra de almacenamiento. */
export const EXTRA_STORAGE_COST = 10

/** Tasa de seguro sobre el valor FOB (mínimo $33). */
export const INSURANCE_RATE = 0.03
export const INSURANCE_MIN = 33

/**
 * Calcula el peso volumétrico de un paquete.
 * Divisor estándar aéreo: 5000 cm³/kg.
 * Gratis hasta 2× el peso real; el exceso se cobra a $10/kg.
 * @param {PackageDimensions} dim
 * @param {number} realWeightKg
 * @returns {{ volumetricKg: number, chargeableKg: number, excessKg: number, excessCost: number }}
 */
export function quoteVolumetric(dim, realWeightKg) {
  if (!dim) return { volumetricKg: 0, chargeableKg: realWeightKg, excessKg: 0, excessCost: 0 }
  const volumetricKg = round2((dim.lengthCm * dim.widthCm * dim.heightCm) / 5000)
  const freeThreshold = round2(realWeightKg * 2)
  const excessKg = volumetricKg > freeThreshold ? round2(volumetricKg - freeThreshold) : 0
  const excessCost = round2(excessKg * 10)
  const chargeableKg = round2(realWeightKg + excessKg)
  return { volumetricKg, chargeableKg, excessKg, excessCost }
}

/**
 * Calcula el flete por peso (tramos).
 * @param {number} weightKg  Peso cobrable (puede incluir exceso volumétrico)
 * @returns {number} Flete en USD
 */
export function quoteByWeight(weightKg) {
  const grams = weightKg * 1000
  if (grams <= 500) return SMALL_PARCEL_RATE.upTo500g
  if (grams <= 600) return SMALL_PARCEL_RATE.upTo600g
  const tier = WEIGHT_TIERS.find((t) => weightKg <= t.maxKg) || { ratePerKg: 0 }
  if (tier.ratePerKg === 0) return -1 // >20kg — tarifa especial, contactar
  return round2(weightKg * tier.ratePerKg)
}

/**
 * Cotiza el costo de asegurar un paquete.
 * @param {number} declaredValue  Valor FOB en USD
 * @returns {number}
 */
export function quoteInsurance(declaredValue) {
  return round2(Math.max(declaredValue * INSURANCE_RATE, INSURANCE_MIN))
}

/**
 * Calcula los días en almacén y el costo de almacenamiento extra.
 * @param {string} receivedAt  ISO timestamp
 * @returns {{ daysInStorage: number, daysLeft: number, extraCost: number }}
 */
export function storageInfo(receivedAt) {
  const days = Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86_400_000)
  const daysLeft = Math.max(FREE_STORAGE_DAYS - days, 0)
  const extraDays = Math.max(days - FREE_STORAGE_DAYS, 0)
  const extraPeriods = Math.ceil(extraDays / 15)
  return { daysInStorage: days, daysLeft, extraCost: extraPeriods * EXTRA_STORAGE_COST }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────

let _pkgSeq = 100
let _shipSeq = 10
let _alertSeq = 50

/**
 * Crea un nuevo paquete (recibido en almacén Miami).
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
    insured: input.insured || false,
    insuranceCost: input.insured ? quoteInsurance(input.declaredValue || 0) : 0,
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
 * Crea un envío consolidando N paquetes del casillero.
 * @param {Package[]} packages  Los paquetes a incluir (deben estar en estado 'ready')
 * @param {{ insureAll?: boolean }} [opts]
 * @returns {LockerShipment}
 */
export function createShipmentFromPackages(packages, opts = {}) {
  _shipSeq += 1
  const id = `SH-2026-${String(_shipSeq).padStart(5, '0')}`
  const now = new Date().toISOString()

  const totalWeightKg = round2(packages.reduce((s, p) => s + p.weightKg, 0))
  const totalDeclaredValue = round2(packages.reduce((s, p) => s + p.declaredValue, 0))

  // Peso volumétrico consolidado (suma de los excesos individuales)
  const volumetricExcess = round2(
    packages.reduce((s, p) => {
      const { excessKg } = quoteVolumetric(p.dimensions, p.weightKg)
      return s + excessKg
    }, 0),
  )
  const volumetricWeightKg = round2(totalWeightKg + volumetricExcess)
  const chargeableKg = volumetricWeightKg

  const freight = quoteByWeight(chargeableKg)
  const handling = HANDLING_FEE
  const insurance = opts.insureAll ? quoteInsurance(totalDeclaredValue) : 0
  const total = round2(freight + handling + insurance)

  return {
    id,
    suiteId: packages[0]?.suiteId || '',
    packageIds: packages.map((p) => p.id),
    totalWeightKg,
    volumetricWeightKg,
    freight,
    handling,
    insurance,
    total,
    status: 'pending_payment',
    createdAt: now,
    dispatchedAt: null,
  }
}
