// Datos del cliente y sus órdenes — hardcodeados para el Área del Cliente.

export const currentUser = {
  name: 'Yanet Rodríguez',
  email: 'yanet.rodriguez@email.com',
  phone: '+598 99 765 432',
  since: '2024-08-12',
  avatarInitials: 'YR',
  tier: 'Cliente Frecuente',
}

export const addresses = [
  {
    id: 'addr-1',
    label: 'Mamá — Montevideo',
    recipient: 'Mercedes Pérez León',
    ci: '19876543',
    phone: '+598 99 123 456',
    province: 'MVD',
    municipality: 'Cordón',
    street: 'Av. 18 de Julio 1234, Centro',
    isDefault: true,
  },
  {
    id: 'addr-2',
    label: 'Hermano — Salto',
    recipient: 'Luis Rodríguez León',
    ci: '45678901',
    phone: '+598 98 234 567',
    province: 'SAL',
    municipality: 'Salto',
    street: 'Calle Uruguay 456, Barrio Centro',
    isDefault: false,
  },
]

export const paymentMethods = [
  { id: 'pm-1', type: 'visa', last4: '4242', exp: '08/27', isDefault: true },
  { id: 'pm-2', type: 'mastercard', last4: '5588', exp: '11/26', isDefault: false },
  { id: 'pm-3', type: 'paypal', email: 'yanet.rodriguez@email.com', isDefault: false },
]

export const orders = [
  {
    id: 'OPT-MVD-2026-00847',
    date: '2026-06-08T14:32:00',
    status: 'in_transit',
    recipient: 'Mercedes Pérez León',
    province: 'MVD',
    method: 'express',
    items: [{ id: 'ef-delta-2-max', name: 'EcoFlow DELTA 2 Max', qty: 1, price: 1099, icon: 'BatteryCharging', tint: '#E31E24' }],
    subtotal: 1099,
    shipping: 121.55,
    customs: 131.88,
    total: 1352.43,
    eta: '20–22 jun 2026',
  },
  {
    id: 'OPT-SAL-2026-00731',
    date: '2026-05-21T09:15:00',
    status: 'delivered',
    recipient: 'Luis Rodríguez León',
    province: 'SAL',
    method: 'standard',
    items: [{ id: 'macbook-air-m3', name: 'MacBook Air 13" M3', qty: 1, price: 1099, icon: 'Laptop', tint: '#22C55E' }],
    subtotal: 1099,
    shipping: 26.04,
    customs: 131.88,
    total: 1256.92,
    eta: 'Entregado el 09 jun 2026',
  },
  {
    id: 'OPT-CAN-2026-00692',
    date: '2026-05-10T17:48:00',
    status: 'customs',
    recipient: 'Mercedes Pérez León',
    province: 'CAN',
    method: 'standard',
    items: [
      { id: 'segway-max-g2', name: 'Segway Ninebot MAX G2', qty: 1, price: 899, icon: 'Bike', tint: '#A8A8A8' },
      { id: 'ecoflow-panel-400', name: 'EcoFlow Panel Solar 400W', qty: 1, price: 599, icon: 'Cable', tint: '#A855F7' },
    ],
    subtotal: 1498,
    shipping: 95.7,
    customs: 179.76,
    total: 1773.46,
    eta: '18–21 jun 2026',
  },
]

export const orderStatusMap = {
  pending: { label: 'Pago pendiente', color: '#F5A524' },
  processing: { label: 'En preparación', color: '#A8A8A8' },
  customs: { label: 'En aduana', color: '#F5A524' },
  in_transit: { label: 'En tránsito', color: '#E31E24' },
  delivered: { label: 'Entregado', color: '#22C55E' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
}
