import * as Icons from 'lucide-react'

export default function EmptyState({ icon = 'PackageOpen', title, description, action }) {
  const Icon = Icons[icon] || Icons.PackageOpen
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border border-[var(--bd-2)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <Icon size={28} className="text-[var(--fg-3)]" strokeWidth={1.5} />
      </div>
      <h3 className="font-display font-bold text-lg text-[var(--fg-1)] mb-2">{title}</h3>
      {description && <p className="text-sm text-[var(--fg-3)] max-w-sm mb-6">{description}</p>}
      {action}
    </div>
  )
}
