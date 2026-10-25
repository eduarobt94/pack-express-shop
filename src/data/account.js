// Datos del cliente y sus compras — hardcodeados (demo).
// Estado logístico y estado de pago son independientes: uno no sustituye al otro.

export const currentUser = {
  name: 'Yanet Rodríguez',
  email: 'yanet.rodriguez@email.com',
  phone: '+598 99 765 432',
  code: 'OPT-UY-096582',
  since: '2026-08-12',
  avatarInitials: 'YR',
}

// Destinatarios en Cuba. El documento de identidad es opcional: se pide solo si
// el operador de transporte lo exige (pendiente de confirmar).
export const addresses = [
  {
    id: 'addr-1',
    label: 'Mamá — La Habana',
    recipient: 'Mercedes Pérez León',
    idDoc: '',
    phone: '+53 5234 5678',
    province: 'HAB',
    municipality: 'Plaza de la Revolución',
    street: 'Calle 23 #456 e/ G y H, Vedado',
    isDefault: true,
  },
  {
    id: 'addr-2',
    label: 'Hermano — Santiago',
    recipient: 'Luis Rodríguez León',
    idDoc: '',
    phone: '+53 5345 6789',
    province: 'SCU',
    municipality: 'Santiago de Cuba',
    street: 'Av. Victoriano Garzón #210, Reparto Sueño',
    isDefault: false,
  },
]

// Compras registradas. Importes: producto (se paga en la tienda) y liquidación a Optimus.
export const orders = [
  {
    id: 'OPT-HAB-2026-00847',
    date: '2026-10-08T14:32:00',
    store: 'Amazon',
    storeOrder: '112-3456789-0123456',
    shipStatus: 'dispatched',
    payStatus: 'paid',
    recipient: 'Mercedes Pérez León',
    province: 'HAB',
    items: [{ id: 'ef-delta-2-max', name: 'EcoFlow DELTA 2 Max', qty: 1, price: 1099, icon: 'BatteryCharging', tint: '#E31E24' }],
    productValue: 1099,
    weightKg: 25,
    commission: 109.9,
    shipping: 275,
    optimusTotal: 384.9,
    rateSnapshot: { commissionRate: 0.1, sellRatePerKg: 11 },
  },
  {
    id: 'OPT-SCU-2026-00731',
    date: '2026-09-21T09:15:00',
    store: 'Amazon',
    storeOrder: '114-7654321-0987654',
    shipStatus: 'delivered',
    payStatus: 'paid',
    recipient: 'Luis Rodríguez León',
    province: 'SCU',
    items: [{ id: 'ef-river-2-pro', name: 'EcoFlow RIVER 2 Pro', qty: 1, price: 539, icon: 'BatteryCharging', tint: '#E31E24' }],
    productValue: 539,
    weightKg: 9,
    commission: 53.9,
    shipping: 99,
    optimusTotal: 152.9,
    rateSnapshot: { commissionRate: 0.1, sellRatePerKg: 11 },
  },
  {
    id: 'OPT-HAB-2026-00892',
    date: '2026-10-19T17:48:00',
    store: 'Amazon',
    storeOrder: '113-1112223-3334445',
    shipStatus: 'received_us',
    payStatus: 'pending',
    recipient: 'Mercedes Pérez León',
    province: 'HAB',
    items: [{ id: 'ecoflow-panel-400', name: 'EcoFlow Panel Solar 400W', qty: 1, price: 599, icon: 'Cable', tint: '#A8A8A8' }],
    productValue: 599,
    weightKg: 18,
    commission: 59.9,
    shipping: 198,
    optimusTotal: 257.9,
    rateSnapshot: { commissionRate: 0.1, sellRatePerKg: 11 },
  },
]

// Estado logístico del paquete o envío
export const shipStatusMap = {
  pending_reception: { label: 'Pendiente de recepción', color: '#A8A8A8' },
  received_us: { label: 'Recibido en EE.UU.', color: '#A8A8A8' },
  preparing: { label: 'En preparación', color: '#A8A8A8' },
  ready: { label: 'Listo para despacho', color: '#22C55E' },
  dispatched: { label: 'Despachado', color: '#E31E24' },
  in_cuba: { label: 'En Cuba', color: '#E31E24' },
  out_for_delivery: { label: 'En reparto', color: '#E31E24' },
  delivered: { label: 'Entregado', color: '#22C55E' },
  incident: { label: 'Incidencia', color: '#EF4444' },
}

// Estado de la liquidación y el pago (se registra en sucursal)
export const payStatusMap = {
  estimate: { label: 'Estimación', color: '#A8A8A8' },
  issued: { label: 'Liquidación emitida', color: '#A8A8A8' },
  pending: { label: 'Pendiente de pago', color: '#F5A524' },
  partial: { label: 'Pago parcial', color: '#F5A524' },
  paid: { label: 'Pagado', color: '#22C55E' },
  refund: { label: 'Saldo a favor o devolución pendiente', color: '#A8A8A8' },
}
