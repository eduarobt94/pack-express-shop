import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// Cada prueba parte de un navegador limpio: sin almacenamiento ni tema previos.
beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => cleanup())

// jsdom no implementa estas APIs que usan framer-motion y la navegación
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
globalThis.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
window.scrollTo = () => {}
