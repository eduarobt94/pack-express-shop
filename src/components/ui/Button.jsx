import { Link } from 'react-router-dom'

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none'

const sizes = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-6 py-3 text-sm',
  lg: 'px-7 py-3.5 text-[15px]',
}

const variants = {
  primary:
    'bg-[#F07232] hover:bg-[#E8823C] text-white hover:shadow-[0_0_32px_rgba(240,114,50,0.32)]',
  blue: 'bg-[#527ED8] hover:bg-[#6B90DC] text-white hover:shadow-[0_0_28px_rgba(82,126,216,0.28)]',
  outline:
    'border border-[#527ED8]/25 hover:border-[#527ED8]/55 text-[var(--fg-2)] hover:text-[#6B90DC] bg-[#527ED8]/[0.06] hover:bg-[#527ED8]/[0.12] backdrop-blur-xl',
  ghost: 'text-[var(--fg-2)] hover:text-[var(--fg-1)] hover:bg-[var(--bd-1)]',
  subtle: 'bg-[var(--bg-elevated)] border border-[var(--bd-2)] text-[var(--fg-1)] hover:border-[var(--bd-3)]',
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
