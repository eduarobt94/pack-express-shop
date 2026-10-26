import { MARKETPLACES } from '../../lib/marketplaces/types'

/**
 * Etiqueta discreta con la tienda de origen de un producto: texto fino sobre papel, sin color de marca de terceros.
 * @param {{ marketplace: 'amazon'|'temu'|'walmart', size?: 'sm'|'md' }} props
 */
export default function MarketplaceBadge({ marketplace, size = 'sm' }) {
  const meta = MARKETPLACES[marketplace]
  if (!meta) return null
  const pad = size === 'md' ? 'px-3.5 py-1.5 text-[12px]' : 'px-3 py-1 text-[11px]'
  return (
    <span className={`inline-flex items-center rounded-full font-medium tracking-[0.04em] bg-[var(--bg-base)] text-[var(--fg-2)] border border-[var(--bd-2)] ${pad}`}>
      {meta.name}
    </span>
  )
}
