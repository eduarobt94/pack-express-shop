import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'

// Referencia: WCAG 2.2 AA. axe-core solo detecta una parte de los problemas (≈30–40 %): estas pruebas se complementan con la
// revisión manual de docs/automated-testing-report.md (lector de pantalla, zoom 200 %, foco en modales).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const PAGES = [
  ['inicio', '/'],
  ['catálogo', '/catalogo'],
  ['producto', '/producto/ef-delta-2-max'],
  ['cómo comprar', '/como-comprar'],
  ['tarifas', '/tarifas'],
  ['contacto', '/contacto'],
  ['seguimiento', '/seguimiento'],
  ['resultado de seguimiento', '/seguimiento/OPT-HAB-2026-00847'],
  ['cuenta', '/cuenta'],
]

async function scan(page, extra = (b) => b) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(700) // las animaciones de entrada (framer-motion) afectan al cálculo de contraste
  const results = await extra(new AxeBuilder({ page }).withTags(TAGS)).analyze()
  return results.violations
}

const summarize = (v) => v.map((x) => `${x.id} [${x.impact}] ×${x.nodes.length}: ${x.help} → ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)

for (const theme of ['light', 'dark']) {
  test.describe(`Accesibilidad automática (axe, WCAG 2.2 AA) — tema ${theme}`, () => {
    for (const [name, path] of PAGES) {
      test(`${name}`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem('pexs-theme', t), theme)
        await page.goto(path)
        const violations = await scan(page)
        expect(summarize(violations), `violaciones en ${path}`).toEqual([])
      })
    }
  })
}

test.describe('Accesibilidad de componentes interactivos', () => {
  test('formulario de ingreso/registro', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^ingresar$/i }).first().click()
    await expect(page.getByText('Acceder al Casillero')).toBeVisible()
    expect(summarize(await scan(page))).toEqual([])
    await page.getByRole('button', { name: /regístrate gratis/i }).click()
    expect(summarize(await scan(page))).toEqual([])
  })

  test('liquidación (panel lateral) y formulario de compra registrada', async ({ page, newUser, loginAs }) => {
    await loginAs(await newUser('a11y'))
    await page.goto('/casillero')
    await page.getByText('Listo para despacho').first().click()
    await page.getByRole('button', { name: /solicitar liquidación/i }).first().click()
    await expect(page.getByText('Liquidación estimada')).toBeVisible()
    expect(summarize(await scan(page))).toEqual([])
  })

  test('los campos de formulario tienen nombre accesible', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^ingresar$/i }).first().click()
    await page.getByRole('button', { name: /regístrate gratis/i }).click()
    for (const ph of ['Tu nombre completo', 'tucorreo@email.com', '+598 99 123 456', 'Mínimo 8 caracteres', 'Repite la contraseña']) {
      const input = page.getByPlaceholder(ph)
      const name = await input.evaluate((el) => el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))
      expect(name, `campo "${ph}" sin etiqueta accesible`).toBeTruthy()
    }
  })

  test('el idioma, el título y los puntos de referencia (landmarks) existen', async ({ page }) => {
    await page.goto('/tarifas')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page).toHaveTitle(/.+/)
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('banner')).toHaveCount(1)
    await expect(page.getByRole('contentinfo')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })
})
