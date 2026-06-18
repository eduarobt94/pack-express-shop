// Modelo canónico de la Orden Pack Express (US → Cuba).
// Define la forma completa de una orden, el generador del número PKX y la
// factory createOrder() que ensambla la orden desde el carrito + checkout.
// Datos hardcodeados / simulados en Fase 0: no hay API ni base de datos.

import { provincesCuba, quoteShipping } from './shipping'

// ─────────────────────────────────────────────────────────────────────────
// Estados y flujo
// ─────────────────────────────────────────────────────────────────────────

/** Orden de los estados en el ciclo de vida normal (happy path). */
export const ORDER_FLOW = [
  'pending', // orden creada, esperando confirmación de pago
  'processing', // pago confirmado, equipo revisando
  'purchasing', // comprando el producto en EE.UU.
  'preparing', // en almacén Miami: empaque + documentación
  'in_transit', // en tránsito internacional Miami → Cuba
  'customs', // en aduana de Cuba
  'out_for_delivery', // en reparto local por provincia
  'delivered', // entregado al destinatario
]

/** Estados terminales fuera del flujo normal. */
export const ORDER_TERMINAL = ['cancelled', 'refunded', 'incident']

/** Metadatos de cada estado: label visible + color de badge. */
export const ORDER_STATUS_META = {
  pending: { label: 'Pago pendiente', color: '#F5A524' },
  processing: { label: 'En preparación', color: '#527ED8' },
  purchasing: { label: 'Comprando producto', color: '#527ED8' },
  preparing: { label: 'Preparando envío', color: '#527ED8' },
  in_transit: { label: 'En tránsito', color: '#F07232' },
  customs: { label: 'En aduana', color: '#F5A524' },
  out_for_delivery: { label: 'En reparto', color: '#F07232' },
  delivered: { label: 'Entregado', color: '#22C55E' },
  cancelled: { label: 'Cancelado', color: '#EF4444' },
  refunded: { label: 'Reembolsado', color: '#A855F7' },
  incident: { label: 'Incidencia', color: '#EF4444' },
}

// ─────────────────────────────────────────────────────────────────────────
// Typedefs (JSDoc) — documentan la forma sin imponer TypeScript
// ─────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} OrderBuyer  Comprador (quien paga, en EE.UU.)
 * @property {string} name
 * @property {string} email
 * @property {string} phone     Teléfono en EE.UU.
 */

/**
 * @typedef {Object} OrderRecipient  Destinatario (quien recibe, en Cuba)
 * @property {string} name
 * @property {string} ci           Carné de Identidad — 11 dígitos (requisito Aduanas)
 * @property {string} province     Código de provincia (HAB, SCU, …)
 * @property {string} municipality
 * @property {string} street
 * @property {string} phone        Teléfono en Cuba
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} id           productId
 * @property {string} name
 * @property {string} [brand]
 * @property {number} qty
 * @property {number} price        Precio unitario USD
 * @property {number} weightKg     Peso unitario
 * @property {string} [icon]       Ícono lucide para ProductVisual
 * @property {string} [tint]       Color de marca para ProductVisual
 */

/**
 * @typedef {Object} OrderPricing  Desglose financiero (todo en USD)
 * @property {number} subtotal     Suma de productos
 * @property {number} shipping     Flete según zona + método
 * @property {number} customs      Aduana (12% del valor declarado)
 * @property {number} handling     Gestión logística (fijo)
 * @property {number} discount     Descuento por cupón
 * @property {number} total        Total final a pagar
 * @property {number} declaredValue Valor declarado para aduana
 */

/**
 * @typedef {Object} OrderPayment
 * @property {'card'|'paypal'|'zelle'} method
 * @property {'pending'|'paid'|'failed'|'refunded'} status
 * @property {string|null} transactionId  ID del gateway
 * @property {string|null} paidAt         ISO timestamp
 * @property {string} [last4]             Últimos 4 dígitos (si card)
 */

/**
 * @typedef {Object} OrderShipping
 * @property {'standard'|'express'} method
 * @property {string} zone          Zona Cuba A–E
 * @property {string} eta           Rango de días estimado
 * @property {string|null} trackingCode  Código del courier (al despachar)
 * @property {string|null} courier
 */

/**
 * @typedef {Object} OrderEvent  Entrada del historial de estados
 * @property {string} status
 * @property {string} at          ISO timestamp
 * @property {string} [note]
 */

/**
 * @typedef {Object} OrderNotification
 * @property {'email'|'whatsapp'} channel
 * @property {string} status        Estado que la disparó
 * @property {string} at            ISO timestamp
 */

/**
 * @typedef {Object} Order
 * @property {string} id            PKX-{PROVINCIA}-{AÑO}-{SEQ}
 * @property {string} createdAt     ISO timestamp
 * @property {string} status        Estado actual
 * @property {'web'|'mobile'|'admin'} channel
 * @property {OrderBuyer} buyer
 * @property {OrderRecipient} recipient
 * @property {OrderItem[]} items
 * @property {OrderPricing} pricing
 * @property {OrderPayment} payment
 * @property {OrderShipping} shipping
 * @property {OrderEvent[]} statusHistory
 * @property {OrderNotification[]} notifications
 * @property {string[]} internalNotes  Notas del agente / incidencias
 */

// ─────────────────────────────────────────────────────────────────────────
// Generador del número de orden: PKX-{PROVINCIA}-{AÑO}-{SEQ}
// ─────────────────────────────────────────────────────────────────────────

// Secuencia simulada en memoria. En producción la asigna la base de datos.
let _seq = 900

/**
 * Genera un número de orden único.
 * @param {string} provinceCode  Código de provincia destino (HAB, SCU, …)
 * @param {Date} [date]
 * @returns {string} Ej: PKX-HAB-2026-00901
 */
export function generateOrderNumber(provinceCode, date = new Date()) {
  const prov = (provinceCode || 'HAB').toUpperCase()
  const year = date.getFullYear()
  _seq += 1
  const seq = String(_seq).padStart(5, '0')
  return `PKX-${prov}-${year}-${seq}`
}

// ─────────────────────────────────────────────────────────────────────────
// Validación mínima del destinatario (requisitos de Aduanas Cuba)
// ─────────────────────────────────────────────────────────────────────────

/** El CI cubano debe tener exactamente 11 dígitos. */
export const isValidCI = (ci) => /^\d{11}$/.test(String(ci || '').trim())

// ─────────────────────────────────────────────────────────────────────────
// Factory: ensambla una Orden completa desde el carrito + checkout
// ─────────────────────────────────────────────────────────────────────────

/**
 * Crea una orden completa a partir de los datos de checkout.
 * Calcula el desglose financiero con el motor de tarifas (quoteShipping)
 * y construye el historial de estados y notificaciones iniciales.
 *
 * @param {Object} input
 * @param {OrderBuyer} input.buyer
 * @param {OrderRecipient} input.recipient
 * @param {OrderItem[]} input.items
 * @param {'standard'|'express'} [input.method='standard']
 * @param {OrderPayment['method']} [input.paymentMethod='card']
 * @param {{ code: string, percent: number }} [input.coupon]  Ej: { code:'CUBA5', percent:5 }
 * @param {'web'|'mobile'|'admin'} [input.channel='web']
 * @returns {Order}
 */
export function createOrder({
  buyer,
  recipient,
  items,
  method = 'standard',
  paymentMethod = 'card',
  coupon = null,
  channel = 'web',
}) {
  const now = new Date()
  const createdAt = now.toISOString()

  // Totales de productos
  const subtotal = round2(items.reduce((s, it) => s + it.price * it.qty, 0))
  const totalWeight = round2(items.reduce((s, it) => s + (it.weightKg || 0) * it.qty, 0))

  // Motor de tarifas (flete + aduana + gestión) según zona y método
  const quote = quoteShipping({
    weightKg: totalWeight,
    value: subtotal,
    provinceCode: recipient.province,
    method,
  })

  // Descuento por cupón (sobre el subtotal de productos)
  const discount = coupon ? round2(subtotal * (coupon.percent / 100)) : 0

  const total = round2(quote.freight + quote.customs + quote.handling + subtotal - discount)

  const id = generateOrderNumber(recipient.province, now)

  /** @type {OrderPricing} */
  const pricing = {
    subtotal,
    shipping: quote.freight,
    customs: quote.customs,
    handling: quote.handling,
    discount,
    total,
    declaredValue: subtotal,
  }

  /** @type {Order} */
  return {
    id,
    createdAt,
    status: 'pending',
    channel,
    buyer,
    recipient,
    items,
    pricing,
    payment: {
      method: paymentMethod,
      status: 'pending',
      transactionId: null,
      paidAt: null,
    },
    shipping: {
      method,
      zone: quote.province.zone,
      eta: quote.eta,
      trackingCode: null,
      courier: null,
    },
    statusHistory: [{ status: 'pending', at: createdAt, note: 'Orden generada' }],
    notifications: [
      { channel: 'email', status: 'pending', at: createdAt },
      { channel: 'whatsapp', status: 'pending', at: createdAt },
    ],
    internalNotes: [],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Transición de estado (registra evento + notificación)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Devuelve una nueva orden con el estado avanzado y el evento registrado.
 * No muta la orden original (patrón inmutable, amigable con React).
 * @param {Order} order
 * @param {string} nextStatus
 * @param {string} [note]
 * @returns {Order}
 */
export function transitionOrder(order, nextStatus, note) {
  const at = new Date().toISOString()
  return {
    ...order,
    status: nextStatus,
    statusHistory: [...order.statusHistory, { status: nextStatus, at, note }],
    notifications: [...order.notifications, { channel: 'whatsapp', status: nextStatus, at }],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const round2 = (n) => Math.round(n * 100) / 100

/** Resuelve el nombre completo de la provincia destino de una orden. */
export const orderProvinceName = (order) =>
  provincesCuba.find((p) => p.code === order.recipient?.province)?.name || '—'

// ─────────────────────────────────────────────────────────────────────────
// Orden de ejemplo (simulada) — útil para confirmación de checkout y demos
// ─────────────────────────────────────────────────────────────────────────

/** @type {Order} */
export const exampleOrder = createOrder({
  buyer: {
    name: 'Yanet Rodríguez',
    email: 'yanet.rodriguez@email.com',
    phone: '+1 (305) 555-0147',
  },
  recipient: {
    name: 'Mercedes Pérez León',
    ci: '54091205832',
    province: 'HAB',
    municipality: 'Plaza de la Revolución',
    street: 'Calle 23 #456 e/ G y H, Vedado',
    phone: '+53 5234 5678',
  },
  items: [
    {
      id: 'ef-delta-2-max',
      name: 'EcoFlow DELTA 2 Max',
      brand: 'EcoFlow',
      qty: 1,
      price: 1099,
      weightKg: 23,
      icon: 'BatteryCharging',
      tint: '#F07232',
    },
  ],
  method: 'express',
  paymentMethod: 'card',
  coupon: { code: 'CUBA5', percent: 5 },
})
