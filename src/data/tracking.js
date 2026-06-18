// Datos de seguimiento — hardcodeados. Indexados por número de orden.

export const trackingData = {
  'PKX-HAB-2026-00847': {
    order: 'PKX-HAB-2026-00847',
    product: 'EcoFlow DELTA 2 Max',
    recipient: 'Mercedes Pérez León',
    destination: 'La Habana, Cuba',
    method: 'express',
    eta: '20–22 jun 2026',
    currentStep: 3,
    location: 'En vuelo · Miami (MIA) → La Habana (HAV)',
    steps: [
      { key: 'confirmed', label: 'Pedido confirmado', desc: 'Pago verificado y orden generada', date: '2026-06-08T14:32:00', done: true },
      { key: 'purchased', label: 'Compra realizada en EE.UU.', desc: 'Producto adquirido del proveedor', date: '2026-06-09T10:05:00', done: true },
      { key: 'warehouse', label: 'En almacén Miami', desc: 'Recibido, inspeccionado y consolidado', date: '2026-06-11T16:20:00', done: true },
      { key: 'transit', label: 'En tránsito a Cuba', desc: 'En vuelo hacia La Habana', date: '2026-06-13T08:00:00', done: false, active: true },
      { key: 'customs', label: 'Aduana de Cuba', desc: 'Despacho aduanal en proceso', date: null, done: false },
      { key: 'delivery', label: 'Entrega al destinatario', desc: 'Entrega final en domicilio', date: null, done: false },
    ],
    history: [
      { date: '2026-06-13T08:00:00', text: 'Paquete embarcado en vuelo MIA → HAV', icon: 'Plane' },
      { date: '2026-06-11T16:20:00', text: 'Consolidado en almacén de Miami', icon: 'Warehouse' },
      { date: '2026-06-11T09:14:00', text: 'Paquete recibido en almacén de Miami', icon: 'PackageCheck' },
      { date: '2026-06-09T10:05:00', text: 'Compra confirmada con el proveedor', icon: 'ShoppingBag' },
      { date: '2026-06-08T14:32:00', text: 'Orden PKX-HAB-2026-00847 generada', icon: 'Receipt' },
    ],
  },
  'PKX-CMG-2026-00692': {
    order: 'PKX-CMG-2026-00692',
    product: 'Segway Ninebot MAX G2 + Panel Solar 400W',
    recipient: 'Mercedes Pérez León',
    destination: 'Camagüey, Cuba',
    method: 'standard',
    eta: '18–21 jun 2026',
    currentStep: 4,
    location: 'Aduana de La Habana · En despacho',
    steps: [
      { key: 'confirmed', label: 'Pedido confirmado', desc: 'Pago verificado y orden generada', date: '2026-05-10T17:48:00', done: true },
      { key: 'purchased', label: 'Compra realizada en EE.UU.', desc: 'Producto adquirido del proveedor', date: '2026-05-12T11:30:00', done: true },
      { key: 'warehouse', label: 'En almacén Miami', desc: 'Recibido, inspeccionado y consolidado', date: '2026-05-15T14:10:00', done: true },
      { key: 'transit', label: 'En tránsito a Cuba', desc: 'En vuelo hacia La Habana', date: '2026-05-18T08:00:00', done: true },
      { key: 'customs', label: 'Aduana de Cuba', desc: 'Despacho aduanal en proceso', date: '2026-06-12T10:00:00', done: false, active: true },
      { key: 'delivery', label: 'Entrega al destinatario', desc: 'Entrega final en domicilio', date: null, done: false },
    ],
    history: [
      { date: '2026-06-12T10:00:00', text: 'Paquete en proceso de despacho aduanal', icon: 'Landmark' },
      { date: '2026-05-18T08:00:00', text: 'Paquete embarcado en vuelo a Cuba', icon: 'Plane' },
      { date: '2026-05-15T14:10:00', text: 'Consolidado en almacén de Miami', icon: 'Warehouse' },
      { date: '2026-05-12T11:30:00', text: 'Compra confirmada con el proveedor', icon: 'ShoppingBag' },
      { date: '2026-05-10T17:48:00', text: 'Orden PKX-CMG-2026-00692 generada', icon: 'Receipt' },
    ],
  },
}

export const getTracking = (order) => trackingData[(order || '').trim().toUpperCase()]
