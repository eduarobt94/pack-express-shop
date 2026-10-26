// Modelo de la Compra Optimus Envíos (cliente en Uruguay → destinatario en Cuba).
//
// Se distinguen tres objetos: pedido de tienda (compra), paquete recibido y envío a Cuba.
// Estado logístico y estado de pago son independientes (ver data/account.js).
// El cliente no paga el producto dentro de Optimus: solo comisión y envío, en sucursal.

import { provincesCuba, quoteShipping, TARIFAS } from './shipping'

/**
 * @typedef {Object} Recipient  Destinatario en Cuba
 * @property {string} name
 * @property {string} phone
 * @property {string} province       Código de provincia (HAB, SCU, …)
 * @property {string} municipality
 * @property {string} street
 * @property {string} [idDoc]        Solo si el operador lo exige (pendiente de confirmar)
 */

/**
 * @typedef {Object} Purchase
 * @property {string} id             OPT-{PROVINCIA}-{AÑO}-{SEQ}
 * @property {string} store
 * @property {string} storeOrder     Número de pedido de la tienda
 * @property {Recipient} recipient
 * @property {{ name: string, qty: number, price: number }[]} items
 * @property {number} productValue   Base de la comisión (pagado en la tienda)
 * @property {number|null} weightKg  null hasta que se pese el paquete
 * @property {string} shipStatus
 * @property {string} payStatus
 * @property {{ commissionRate: number, sellRatePerKg: number }} rateSnapshot
 * @property {string} acceptedAt     Fecha en que aceptó las condiciones
 */

let _seq = 900

/** Número de compra: OPT-{PROVINCIA}-{AÑO}-{SEQ}. En producción lo asigna la base de datos. */
export function generatePurchaseId(provinceCode, date = new Date()) {
  _seq += 1
  return `OPT-${(provinceCode || 'HAB').toUpperCase()}-${date.getFullYear()}-${String(_seq).padStart(5, '0')}`
}

/** Nombre de la provincia destino de una compra. */
export const purchaseProvinceName = (purchase) =>
  provincesCuba.find((p) => p.code === purchase.recipient?.province)?.name || '—'

/**
 * Registra una compra. Congela la tarifa vigente para que futuros cambios no
 * alteren liquidaciones ya emitidas.
 * @returns {Purchase}
 */
export function createPurchase({ store, storeOrder, recipient, items, weightKg = null, acceptedAt = new Date().toISOString() }) {
  const productValue = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0) * 100) / 100
  return {
    id: generatePurchaseId(recipient.province),
    store,
    storeOrder,
    recipient,
    items,
    productValue,
    weightKg,
    shipStatus: 'pending_reception',
    payStatus: 'estimate',
    rateSnapshot: { ...TARIFAS },
    acceptedAt,
    estimate: quoteShipping({ value: productValue, weightKg }),
  }
}
