import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--bd-2)] text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:border-[var(--bd-3)] transition-colors cursor-pointer"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
