import { Link } from 'react-router-dom'

// Botones: Inter 600 en minúsculas (como el sitio oficial), radio 8 px, 48 px de alto. Acabado refinado:
// sin sombras de color; la elevación y el color cambian con transiciones lentas de 300 ms.
const base =
  'inline-flex items-center justify-center gap-2.5 font-sans font-semibold rounded-lg ' +
  'transition-[background-color,border-color,color,box-shadow] duration-300 ease-out disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer select-none whitespace-nowrap'

const sizes = {
  sm: 'px-5 h-10 text-[14px]',
  md: 'px-7 h-12 text-[15px]',
  lg: 'px-9 h-14 text-[16px]',
}

const variants = {
  primary: 'bg-[#E31E24] hover:bg-[#C81A1F] text-white',
  // Tinta sólida (negro de marca; en modo oscuro se invierte a blanco)
  blue: 'bg-[var(--fg-1)] hover:bg-[var(--fg-2)] text-[var(--bg-base)]',
  outline: 'border border-[var(--bd-3)] hover:border-[var(--fg-1)] text-[var(--fg-1)] bg-transparent',
  ghost: 'text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:bg-[var(--bd-1)]',
  subtle: 'bg-[var(--bg-elevated)] border border-[var(--bd-2)] text-[var(--fg-1)] hover:border-[var(--bd-4)]',
}

export default function Button({
  as,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const cls = `${base} ${sizes[size]} ${variants[variant]} ${className}`
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>
  if (href) return <a href={href} className={cls} {...props}>{children}</a>
  const Comp = as || 'button'
  return <Comp className={cls} {...props}>{children}</Comp>
}
