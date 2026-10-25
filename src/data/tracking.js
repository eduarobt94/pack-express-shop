// Datos de seguimiento — hardcodeados (demo). Indexados por código de compra.
// Fuente de cada actualización: carga manual de Optimus (sin integración con el operador).

export const trackingData = {
  'OPT-HAB-2026-00847': {
    order: 'OPT-HAB-2026-00847',
    product: 'EcoFlow DELTA 2 Max',
    recipient: 'Mercedes Pérez León',
    destination: 'La Habana, Cuba',
    guide: 'Guía del operador: pendiente de asignar',
    currentStep: 3,
    location: 'Despachado desde EE.UU. · camino a Cuba',
    steps: [
      { key: 'registered', label: 'Compra registrada', desc: 'Comprobante, productos y destinatario cargados', date: '2026-10-08T14:32:00', done: true },
      { key: 'received', label: 'Recibido en EE.UU.', desc: 'Peso, fotos y observaciones registrados', date: '2026-10-12T16:20:00', done: true },
      { key: 'paid', label: 'Liquidación pagada', desc: 'Pago validado en sucursal', date: '2026-10-14T11:00:00', done: true },
      { key: 'dispatched', label: 'Despachado', desc: 'En manos del operador de transporte', date: '2026-10-15T08:00:00', done: false, active: true },
      { key: 'cuba', label: 'En Cuba', desc: 'La aduana la paga el destinatario al recibir', date: null, done: false },
      { key: 'delivery', label: 'Entregado', desc: 'Entrega al destinatario', date: null, done: false },
    ],
    history: [
      { date: '2026-10-15T08:00:00', text: 'Envío despachado', icon: 'Plane' },
      { date: '2026-10-14T11:00:00', text: 'Pago validado en sucursal', icon: 'Wallet' },
      { date: '2026-10-12T16:20:00', text: 'Paquete recibido en EE.UU. (25 kg)', icon: 'PackageCheck' },
      { date: '2026-10-08T14:32:00', text: 'Compra OPT-HAB-2026-00847 registrada', icon: 'Receipt' },
    ],
  },
  'OPT-HAB-2026-00892': {
    order: 'OPT-HAB-2026-00892',
    product: 'EcoFlow Panel Solar 400W',
    recipient: 'Mercedes Pérez León',
    destination: 'La Habana, Cuba',
    guide: 'Guía del operador: pendiente de asignar',
    currentStep: 1,
    location: 'Recibido en EE.UU. · pendiente de pago de la liquidación',
    steps: [
      { key: 'registered', label: 'Compra registrada', desc: 'Comprobante, productos y destinatario cargados', date: '2026-10-19T17:48:00', done: true },
      { key: 'received', label: 'Recibido en EE.UU.', desc: 'Peso, fotos y observaciones registrados', date: '2026-10-22T10:30:00', done: true, active: true },
      { key: 'paid', label: 'Liquidación pagada', desc: 'Con el pago completo se habilita el despacho', date: null, done: false },
      { key: 'dispatched', label: 'Despachado', desc: 'En manos del operador de transporte', date: null, done: false },
      { key: 'cuba', label: 'En Cuba', desc: 'La aduana la paga el destinatario al recibir', date: null, done: false },
      { key: 'delivery', label: 'Entregado', desc: 'Entrega al destinatario', date: null, done: false },
    ],
    history: [
      { date: '2026-10-22T10:30:00', text: 'Paquete recibido en EE.UU. (18 kg)', icon: 'PackageCheck' },
      { date: '2026-10-19T17:48:00', text: 'Compra OPT-HAB-2026-00892 registrada', icon: 'Receipt' },
    ],
  },
}

export const getTracking = (order) => trackingData[(order || '').trim().toUpperCase()]
