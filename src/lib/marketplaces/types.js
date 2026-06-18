// Interfaz común para todos los adapters de marketplace (Amazon, Temu, Walmart…).
// Cada adapter DEBE normalizar sus productos a esta forma para que las vistas
// (Catalog, ProductDetail, ProductCard) funcionen sin conocer el origen.

/**
 * @typedef {Object} MarketplaceProduct
 * @property {string} id            Identificador interno para rutas (= asin/sku)
 * @property {string} asin          ASIN de Amazon (o sku para otros marketplaces)
 * @property {string} title         Nombre del producto
 * @property {string} brand         Marca
 * @property {number} price         Precio
 * @property {string} currency      Código ISO (ej: 'USD')
 * @property {string} image         URL de imagen (o icono lucide como fallback)
 * @property {string} icon          Ícono lucide para ProductVisual (fallback sin imagen)
 * @property {string} tint          Color de marca para ProductVisual
 * @property {string} description   Descripción breve
 * @property {boolean} available    Disponibilidad (stock)
 * @property {string} url           Link al producto en la tienda original
 * @property {'amazon'|'temu'|'walmart'} marketplace
 * @property {number} [rating]      Valoración (si el marketplace la expone)
 * @property {number} [reviews]     N° de reseñas
 */

/** Marketplaces soportados y su metadata visual. */
export const MARKETPLACES = {
  amazon: { id: 'amazon', name: 'Amazon', color: '#F07232', status: 'available' },
  temu: { id: 'temu', name: 'Temu', color: '#E53935', status: 'soon' },
  walmart: { id: 'walmart', name: 'Walmart', color: '#007DC6', status: 'soon' },
}
