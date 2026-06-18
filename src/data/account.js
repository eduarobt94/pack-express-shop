// Datos del cliente y sus órdenes — hardcodeados para el Área del Cliente.

export const currentUser = {
  name: 'Yanet Rodríguez',
  email: 'yanet.rodriguez@email.com',
  phone: '+1 (305) 555-0147',
  since: '2024-08-12',
  avatarInitials: 'YR',
  tier: 'Cliente Frecuente',
}

export const addresses = [
  {
    id: 'addr-1',
    label: 'Mamá — La Habana',
    recipient: 'Mercedes Pérez León',
    ci: '54091205832',
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
    ci: '88112048711',
    phone: '+53 5345 6789',
    province: 'SCU',
    municipality: 'Santiago de Cuba',
    street: 'Av. Victoriano Garzón #210, Reparto Sueño',
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
    id: 'PKX-HAB-2026-00847',
    date: '2026-06-08T14:32:00',
    status: 'in_transit',
    recipient: 'Mercedes Pérez León',
    province: 'HAB',
    method: 'express',
    items: [{ id: 'ef-delta-2-max', name: 'EcoFlow DELTA 2 Max', qty: 1, price: 1099, icon: 'BatteryCharging', tint: '#F07232' }],
    subtotal: 1099,
    shipping: 121.55,
    customs: 131.88,
    total: 1352.43,
    eta: '20–22 jun 2026',
  },
  {
    id: 'PKX-SCU-2026-00731',
    date: '2026-05-21T09:15:00',
    status: 'delivered',
    recipient: 'Luis Rodríguez León',
    province: 'SCU',
    method: 'standard',
    items: [{ id: 'macbook-air-m3', name: 'MacBook Air 13" M3', qty: 1, price: 1099, icon: 'Laptop', tint: '#22C55E' }],
    subtotal: 1099,
    shipping: 26.04,
    customs: 131.88,
    total: 1256.92,
    eta: 'Entregado el 09 jun 2026',
  },
  {
    id: 'PKX-CMG-2026-00692',
    date: '2026-05-10T17:48:00',
    status: 'customs',
    recipient: 'Mercedes Pérez León',
    province: 'CMG',
    method: 'standard',
    items: [
      { id: 'segway-max-g2', name: 'Segway Ninebot MAX G2', qty: 1, price: 899, icon: 'Bike', tint: '#527ED8' },
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
  processing: { label: 'En preparación', color: '#527ED8' },
  customs: { label: 'En aduana', color: '#F5A524' },
  in_transit: { label: 'En tránsito', color: '#F07232' },
  delivered: { label: 'Entregado', color: '#22C55E' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
}
