// Caché ligera en localStorage para respuestas de marketplaces.
// Minimiza llamadas a la API y mejora el rendimiento percibido.
// Cada entrada guarda { data, expiresAt }; se invalida sola al expirar el TTL.

const PREFIX = 'pexs:mkt:'
const DEFAULT_TTL = 30 * 60 * 1000 // 30 minutos

/**
 * Lee una entrada de caché. Devuelve null si no existe o expiró.
 * @template T
 * @param {string} key
 * @returns {T|null}
 */
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, expiresAt } = JSON.parse(raw)
    if (Date.now() > expiresAt) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * Guarda una entrada en caché con TTL.
 * @param {string} key
 * @param {unknown} data
 * @param {number} [ttlMs]
 */
export function cacheSet(key, data, ttlMs = DEFAULT_TTL) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, expiresAt: Date.now() + ttlMs }))
  } catch {
    // localStorage lleno o no disponible — degradación silenciosa
  }
}

/**
 * Limpia todas las entradas cuya key empieza con el prefijo dado.
 * @param {string} [keyPrefix]  Ej: 'amazon:' — vacío limpia todo el namespace de marketplaces
 */
export function cacheClear(keyPrefix = '') {
  try {
    const full = PREFIX + keyPrefix
    Object.keys(localStorage)
      .filter((k) => k.startsWith(full))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // no-op
  }
}
