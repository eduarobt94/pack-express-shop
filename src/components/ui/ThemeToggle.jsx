import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className="flex items-center justify-center w-11 h-11 rounded-lg text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:bg-[var(--bd-1)] transition-colors duration-300 cursor-pointer"
    >
      {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
    </button>
  )
}
