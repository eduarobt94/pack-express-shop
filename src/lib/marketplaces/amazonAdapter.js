// Adapter de Amazon — normaliza productos al contrato MarketplaceProduct.
//
// IMPORTANTE: la Amazon Product Advertising API (PAAPI) NO puede llamarse desde
// el navegador porque expondría las credenciales AWS. Por eso este adapter es
// "proxy-ready": si existe VITE_AMAZON_PROXY_URL (un backend/función serverless
// que firma las requests a PAAPI), lo usa; si no, devuelve datos mock para que
// el flujo completo sea demostrable sin backend.
//
// Para añadir Temu/Walmart en el futuro: crear temuAdapter.js / walmartAdapter.js
// que exporten searchX/getXProduct devolviendo MarketplaceProduct[]. Las vistas
// no cambian.

import { cacheGet, cacheSet } from './cache'

const PROXY_URL = import.meta.env.VITE_AMAZON_PROXY_URL || ''

/** @type {import('./types').MarketplaceProduct[]} */
const MOCK_AMAZON_PRODUCTS = [
  { asin: 'B0B2RDFB2L', title: 'EcoFlow DELTA 2 Portable Power Station', brand: 'EcoFlow', price: 999, currency: 'USD', icon: 'BatteryCharging', tint: '#E31E24', description: '1024Wh estación de energía portátil con recarga rápida y app de control.', available: true, rating: 4.8, reviews: 3120 },
  { asin: 'B0CHX1W1XY', title: 'Apple iPhone 15 Pro 256GB', brand: 'Apple', price: 1099, currency: 'USD', icon: 'Smartphone', tint: '#A8A8A8', description: 'Titanio, chip A17 Pro y sistema de cámara Pro avanzado.', available: true, rating: 4.7, reviews: 8845 },
  { asin: 'B0CX23V2ZK', title: 'Apple MacBook Air 13" M3', brand: 'Apple', price: 1059, currency: 'USD', icon: 'Laptop', tint: '#22C55E', description: 'Chip M3, hasta 18h de batería y pantalla Liquid Retina.', available: true, rating: 4.9, reviews: 2410 },
  { asin: 'B0CQ4Q2RZ9', title: 'Sony WH-1000XM5 Wireless Headphones', brand: 'Sony', price: 328, currency: 'USD', icon: 'Headphones', tint: '#A855F7', description: 'Cancelación de ruido líder, 30h de batería y audio HD.', available: true, rating: 4.6, reviews: 15230 },
  { asin: 'B09B8V1LZ3', title: 'Dyson V15 Detect Cordless Vacuum', brand: 'Dyson', price: 649, currency: 'USD', icon: 'Wind', tint: '#F5A524', description: 'Aspiradora láser con detección de partículas y 60 min de autonomía.', available: true, rating: 4.7, reviews: 5602 },
  { asin: 'B0BSHF7WHW', title: 'Anker 757 PowerHouse 1229Wh', brand: 'Anker', price: 899, currency: 'USD', icon: 'BatteryFull', tint: '#E31E24', description: 'Batería LiFePO4 de larga vida con salida de 1500W.', available: true, rating: 4.6, reviews: 1880 },
  { asin: 'B0C7VWZ9GX', title: 'Samsung 65" Neo QLED 4K Smart TV', brand: 'Samsung', price: 1297, currency: 'USD', icon: 'Tv', tint: '#A8A8A8', description: 'Mini LED, 4K 120Hz y Tizen con apps integradas.', available: true, rating: 4.5, reviews: 940 },
  { asin: 'B0CGY3K7H6', title: 'Segway Ninebot MAX G2 Electric Scooter', brand: 'Segway', price: 899, currency: 'USD', icon: 'Bike', tint: '#22C55E', description: 'Scooter eléctrico con 70 km de alcance y suspensión dual.', available: true, rating: 4.6, reviews: 1325 },
  { asin: 'B07ZPKN6YR', title: 'TP-Link Archer AX73 Wi-Fi 6 Router', brand: 'TP-Link', price: 149, currency: 'USD', icon: 'Wifi', tint: '#A855F7', description: 'Router Wi-Fi 6 de doble banda hasta 5400 Mbps.', available: true, rating: 4.6, reviews: 7110 },
  { asin: 'B0C1J6N5Q2', title: 'EcoFlow 400W Portable Solar Panel', brand: 'EcoFlow', price: 599, currency: 'USD', icon: 'Sun', tint: '#F5A524', description: 'Panel solar plegable de 400W con 23% de eficiencia.', available: false, rating: 4.5, reviews: 612 },
  { asin: 'B08C1W5N87', title: 'DeWalt 20V MAX Power Tool Kit (10-Tool)', brand: 'DeWalt', price: 599, currency: 'USD', icon: 'Wrench', tint: '#E31E24', description: 'Kit combinado de 10 herramientas inalámbricas con baterías.', available: true, rating: 4.8, reviews: 4203 },
  { asin: 'B0BDHWDR12', title: 'Apple iPad Pro 11" M4 Wi-Fi 256GB', brand: 'Apple', price: 999, currency: 'USD', icon: 'Tablet', tint: '#A8A8A8', description: 'Pantalla Ultra Retina XDR y chip M4 para tareas pro.', available: true, rating: 4.8, reviews: 1502 },
]

/**
 * Normaliza un producto crudo (mock o de PAAPI) al contrato MarketplaceProduct.
 * @param {Object} raw
 * @returns {import('./types').MarketplaceProduct}
 */
function normalize(raw) {
  return {
    id: raw.asin,
    asin: raw.asin,
    title: raw.title,
    brand: raw.brand || '',
    price: raw.price,
    currency: raw.currency || 'USD',
    image: raw.image || '',
    icon: raw.icon || 'Package',
    tint: raw.tint || '#A8A8A8',
    description: raw.description || '',
    available: raw.available !== false,
    url: raw.url || `https://www.amazon.com/dp/${raw.asin}`,
    marketplace: 'amazon',
    rating: raw.rating,
    reviews: raw.reviews,
  }
}

/**
 * Busca productos en Amazon. Usa caché (30 min) y proxy si está configurado.
 * @param {string} [query]
 * @param {number} [page]
 * @returns {Promise<import('./types').MarketplaceProduct[]>}
 */
export async function searchAmazon(query = '', page = 1) {
  const key = `amazon:search:${query.toLowerCase().trim()}:${page}`
  const cached = cacheGet(key)
  if (cached) return cached

  let results
  if (PROXY_URL) {
    try {
      const res = await fetch(`${PROXY_URL}/search?q=${encodeURIComponent(query)}&page=${page}`)
      if (!res.ok) throw new Error(`Proxy ${res.status}`)
      const json = await res.json()
      results = (json.items || []).map(normalize)
    } catch {
      results = filterMock(query) // fallback si el proxy falla
    }
  } else {
    results = filterMock(query)
  }

  cacheSet(key, results)
  return results
}

/**
 * Obtiene el detalle de un producto por ASIN. Usa caché y proxy si existe.
 * @param {string} asin
 * @returns {Promise<import('./types').MarketplaceProduct|null>}
 */
export async function getAmazonProduct(asin) {
  if (!asin) return null
  const key = `amazon:product:${asin}`
  const cached = cacheGet(key)
  if (cached) return cached

  let product = null
  if (PROXY_URL) {
    try {
      const res = await fetch(`${PROXY_URL}/product/${encodeURIComponent(asin)}`)
      if (!res.ok) throw new Error(`Proxy ${res.status}`)
      product = normalize(await res.json())
    } catch {
      product = filterMock().find((p) => p.asin === asin) || null
    }
  } else {
    product = filterMock().find((p) => p.asin === asin) || null
  }

  if (product) cacheSet(key, product)
  return product
}

/** Filtra los mocks por query (título/marca/descripción). */
function filterMock(query = '') {
  const all = MOCK_AMAZON_PRODUCTS.map(normalize)
  const q = query.toLowerCase().trim()
  if (!q) return all
  return all.filter(
    (p) => p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
  )
}
