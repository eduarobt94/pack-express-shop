// Colores con contraste suficiente (WCAG 1.4.3 AA) cuando se usan como TEXTO o ícono sobre el fondo del tema.
// Los datos (estados, categorías, marcas) conservan su color de marca para fondos y bordes; al pintar texto se
// resuelve a un token legible por tema definido en index.css.

const READABLE = {
  '#E31E24': 'var(--brand-text)',
  '#22C55E': 'var(--ok-text)',
  '#F5A524': 'var(--warn-text)',
  '#EF4444': 'var(--err-text)',
  '#A855F7': 'var(--purple-text)',
  '#A8A8A8': 'var(--fg-3)',
}

/** Devuelve un color de texto legible para un color de marca; cualquier otro valor se respeta tal cual. */
export function readable(color) {
  return READABLE[typeof color === 'string' ? color.toUpperCase() : color] ?? color
}
