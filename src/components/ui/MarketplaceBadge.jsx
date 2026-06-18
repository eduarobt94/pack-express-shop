import { Store } from 'lucide-react'
import { MARKETPLACES } from '../../lib/marketplaces/types'

/**
 * Badge pequeño que indica el marketplace de origen de un producto.
 * @param {{ marketplace: 'amazon'|'temu'|'walmart', size?: 'sm'|'md' }} props
 */
export default function MarketplaceBadge({ marketplace, size = 'sm' }) {
  const meta = MARKETPLACES[marketplace]
  if (!meta) return null
  const pad = size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad}`}
      style={{ background: `${meta.color}18`, color: meta.color }}
    >
      <Store size={size === 'md' ? 12 : 10} /> {meta.name}
    </span>
  )
}
