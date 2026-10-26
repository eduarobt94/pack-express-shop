import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Pruebas unitarias y de componentes (jsdom). Las pruebas E2E viven en e2e/ y las corre Playwright.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.js'],
    include: ['tests/unit/**/*.test.{js,jsx}'],
    restoreMocks: true,
    testTimeout: 15_000, // userEvent escribe carácter a carácter: margen para máquinas cargadas (CI compartido)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // Alcance de las pruebas unitarias: lógica, contextos, datos y componentes reutilizables. Páginas, layout y secciones de la
      // portada se cubren con E2E (e2e/) y no se mezclan aquí para no inflar ni diluir la métrica.
      include: ['src/lib/**', 'src/context/**', 'src/data/**', 'src/components/ui/**', 'src/components/auth/**'],
      thresholds: { lines: 80, functions: 75, branches: 70, statements: 80 },
    },
  },
})
