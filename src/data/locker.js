// Datos del casillero virtual — hardcodeados (Fase 0, sin API).
// Suite del usuario, paquetes en distintos estados, pre-alertas y envíos.

import { generateSuiteId, MIAMI_ADDRESS } from '../lib/locker'

// ─────────────────────────────────────────────────────────────────────────────
// Suite del usuario actual (corresponde a currentUser en account.js)
// ─────────────────────────────────────────────────────────────────────────────

export const currentSuite = {
  suiteId: generateSuiteId('096582', 'CU'),   // PKX-CU-096582
  country: 'CU',
  address: MIAMI_ADDRESS,
  memberSince: '2024-08-12',
  packagesInLocker: 5,
}

// ─────────────────────────────────────────────────────────────────────────────
// Paquetes en el casillero (distintos estados)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('../lib/locker').Package[]} */
export const lockerPackages = [
  {
    id: 'WR-2026-00101',
    suiteId: currentSuite.suiteId,
    trackingNumber: '1Z999AA10123456784',
    store: 'Amazon',
    description: 'Cargador portátil Anker 26800mAh',
    declaredValue: 55,
    weightKg: 0.52,
    dimensions: { lengthCm: 17, widthCm: 9, heightCm: 4 },
    status: 'ready',
    receivedAt: '2026-06-02T09:14:00',
    photoUrl: null,
    photoRequested: false,
    insured: false,
    insuranceCost: 0,
    shipmentId: null,
    notes: [],
  },
  {
    id: 'WR-2026-00102',
    suiteId: currentSuite.suiteId,
    trackingNumber: '9400111899223397622401',
    store: 'Walmart',
    description: 'Auriculares Bluetooth Sony WH-1000XM5',
    declaredValue: 278,
    weightKg: 0.25,
    dimensions: { lengthCm: 26, widthCm: 22, heightCm: 10 },
    status: 'ready',
    receivedAt: '2026-06-05T14:30:00',
    photoUrl: '/pkg-photo-mock.jpg',
    photoRequested: true,
    insured: true,
    insuranceCost: 33,
    shipmentId: null,
    notes: [],
  },
  {
    id: 'WR-2026-00103',
    suiteId: currentSuite.suiteId,
    trackingNumber: '795644790135',
    store: 'Best Buy',
    description: 'iPad Pro 11" M4 + Apple Pencil Pro',
    declaredValue: 1299,
    weightKg: 1.1,
    dimensions: { lengthCm: 35, widthCm: 27, heightCm: 8 },
    status: 'no_docs',
    receivedAt: '2026-06-08T11:20:00',
    photoUrl: null,
    photoRequested: false,
    insured: false,
    insuranceCost: 0,
    shipmentId: null,
    notes: ['Falta factura de compra. Subir en la sección Documentos.'],
  },
  {
    id: 'WR-2026-00104',
    suiteId: currentSuite.suiteId,
    trackingNumber: '1FedEx923847612',
    store: 'Home Depot',
    description: 'Kit de herramientas Dewalt 20V MAX (20 piezas)',
    declaredValue: 189,
    weightKg: 6.3,
    dimensions: { lengthCm: 50, widthCm: 35, heightCm: 20 },
    status: 'verifying',
    receivedAt: '2026-06-10T16:45:00',
    photoUrl: null,
    photoRequested: false,
    insured: false,
    insuranceCost: 0,
    shipmentId: null,
    notes: ['Verificación de contenido en proceso. Estimado: 24h.'],
  },
  {
    id: 'WR-2026-00098',
    suiteId: currentSuite.suiteId,
    trackingNumber: '1Z999BB20987654321',
    store: 'Amazon',
    description: 'Router Wi-Fi 6 TP-Link Archer AX73',
    declaredValue: 149,
    weightKg: 1.8,
    dimensions: { lengthCm: 30, widthCm: 18, heightCm: 6 },
    status: 'shipped',
    receivedAt: '2026-05-20T10:00:00',
    photoUrl: null,
    photoRequested: false,
    insured: false,
    insuranceCost: 0,
    shipmentId: 'SH-2026-00009',
    notes: [],
  },
  {
    id: 'pkg-006',
    suiteId: currentSuite.suiteId,
    trackingNumber: '7312840029837412',
    store: 'Best Buy',
    description: 'Monitor LG 27" 4K',
    declaredValue: 399,
    weightKg: 6.2,
    dimensions: { lengthCm: 68, widthCm: 44, heightCm: 15 },
    status: 'retained',
    receivedAt: '2026-06-10T09:00:00',
    photoUrl: null,
    photoRequested: false,
    insured: false,
    insuranceCost: 0,
    shipmentId: null,
    notes: [],
    retainedReason: 'Dirección incompleta — requiere corrección',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Pre-alertas (compras declaradas por el usuario antes de llegar)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('../lib/locker').PreAlert[]} */
export const preAlerts = [
  {
    id: 'PA-2026-00051',
    suiteId: currentSuite.suiteId,
    store: 'Temu',
    description: 'Lámpara LED escritorio + soporte monitor',
    declaredValue: 42,
    trackingNumber: 'TMUW202606140012345',
    pieces: 2,
    createdAt: '2026-06-11T20:30:00',
    status: 'pending',
  },
  {
    id: 'PA-2026-00052',
    suiteId: currentSuite.suiteId,
    store: 'eBay',
    description: 'Sensor de temperatura y humedad Govee (pack x4)',
    declaredValue: 67,
    trackingNumber: '9261290100129790195523',
    pieces: 1,
    createdAt: '2026-06-13T10:15:00',
    status: 'pending',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Envíos (shipments ya solicitados)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('../lib/locker').LockerShipment[]} */
export const lockerShipments = [
  {
    id: 'SH-2026-00009',
    suiteId: currentSuite.suiteId,
    packageIds: ['WR-2026-00098'],
    totalWeightKg: 1.8,
    volumetricWeightKg: 1.8,
    freight: 42.3,
    handling: 5,
    insurance: 0,
    total: 47.3,
    status: 'in_transit',
    createdAt: '2026-05-22T09:00:00',
    dispatchedAt: '2026-05-25T08:30:00',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const getPackage = (id) => lockerPackages.find((p) => p.id === id) || null
export const getReadyPackages = () => lockerPackages.filter((p) => p.status === 'ready')
export const getActivePackages = () => lockerPackages.filter((p) => p.status !== 'shipped')
