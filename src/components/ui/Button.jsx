import { Link } from 'react-router-dom'

const base =
  'inline-flex items-center justify-center gap-2 font-display font-extrabold uppercase tracking-[0.02em] rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none'

const sizes = {
  sm: 'px-4 h-10 text-[13px]',
  md: 'px-6 h-12 text-sm',
  lg: 'px-8 h-12 text-sm',
}

const variants = {
  primary:
    'bg-[#E31E24] hover:bg-[#C81A1F] text-white hover:shadow-[0_0_32px_rgba(227,30,36,0.32)]',
  blue: 'bg-[var(--sec)] hover:bg-[var(--sec-hover)] text-[var(--bg-base)] hover:shadow-[0_0_28px_rgba(26,26,26,0.22)]',
  outline:
    'border-[1.5px] border-[#A8A8A8] hover:border-[var(--color-brand)] text-[var(--fg-1)] hover:text-[var(--color-brand)] bg-transparent',
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
