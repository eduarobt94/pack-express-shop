# Optimus Envíos — Shop

Plataforma de Optimus Envíos para cubanos residentes en Uruguay que compran en tiendas de EE.UU. y envían a sus familiares en Cuba.
El producto se paga en la tienda; a Optimus se le paga en sucursal una comisión (10%) y el envío (USD/kg). La aduana de Cuba la paga el destinatario. Ver `src/lib/shipping.js`.
Primera versión funcional (UI completa, datos hardcodeados) para validar experiencia, navegación y flujos de compra/logística.

> Sin APIs, sin base de datos, sin servicios externos. Toda la información está simulada en `src/data/`.

## Stack

Stack:

- **React 19** + **Vite 8**
- **Tailwind CSS v4** (tokens vía `@theme` + variables CSS para dark/light)
- **Framer Motion** (animaciones de entrada y micro-interacciones)
- **React Router v7** (navegación SPA)
- **lucide-react** (iconografía SVG — sin emojis)
- Fuentes: **Montserrat** (títulos) + **Inter** (cuerpo)
- Paleta: rojo `#E31E24`, gris `#A8A8A8`, negro `#1A1A1A`, blanco (manual de marca)

## Scripts

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build
pnpm preview
```

## Arquitectura de carpetas

```
src/
├─ main.jsx              # Entry: Router + ThemeProvider + CartProvider
├─ App.jsx               # Layout + rutas (lazy) + ScrollToTop
├─ index.css            # Tokens de tema (dark/light), reset, utilidades
├─ context/
│  ├─ ThemeContext.jsx   # Dark/light persistido en localStorage
│  └─ CartContext.jsx    # Carrito (useReducer + persistencia)
├─ data/                 # ── MOCK DATA HARDCODEADA ──
│  ├─ products.js        # 12 productos (visual por marca, specs, gallery)
│  ├─ categories.js      # 5 categorías
│  ├─ account.js         # Usuario, órdenes, direcciones, métodos de pago
│  ├─ tracking.js        # Seguimientos indexados por # de orden
│  └─ testimonials.js
├─ lib/
│  ├─ format.js          # formatUSD, formatDate, formatDateTime
│  └─ shipping.js        # Motor de tarifas: zonas Cuba + cálculo aduana
├─ components/
│  ├─ layout/            # Navbar, Footer
│  ├─ home/              # Hero, Categories, FeaturedProducts, Benefits, HowItWorks, Testimonials, CTA
│  └─ ui/                # Button, Badge, Stars, ProductCard, ProductVisual,
│                        # ShippingCalculator, QuantityStepper, Skeleton,
│                        # EmptyState, SectionHeading, ThemeToggle
└─ pages/
   ├─ Home.jsx
   ├─ Catalog.jsx        # Grid + filtros + búsqueda + orden + skeleton/empty
   ├─ ProductDetail.jsx  # Galería + specs + reseñas + calculador de envío
   ├─ Cart.jsx           # Resumen + destino + cupón + totales
   ├─ Checkout.jsx       # Wizard 4 pasos + confirmación con # de orden
   ├─ Tracking.jsx       # Timeline visual + historial (loading/empty)
   ├─ Account.jsx        # Dashboard, pedidos, destinatarios, pagos, soporte
   └─ NotFound.jsx
```

## Rutas

| Ruta | Vista |
|---|---|
| `/` | Home |
| `/catalogo` · `/catalogo?cat=<slug>` | Catálogo con filtros |
| `/producto/:id` | Detalle de producto |
| `/carrito` | Carrito |
| `/checkout` | Checkout (wizard) |
| `/seguimiento` · `/seguimiento/:order` | Tracking |
| `/cuenta` | Área del cliente |

## Datos de prueba

- **Tracking:** `PKX-HAB-2026-00847` (en tránsito), `PKX-CMG-2026-00692` (en aduana)
- **Cupón:** `CUBA5` (−5%)
- **Checkout:** el CI valida 11 dígitos; el formulario muestra errores inline.

## Decisiones UX/UI clave

1. **Transparencia de costos desde la PDP.** El `ShippingCalculator` muestra producto + flete + aduana + gestión = *total en Cuba* antes de añadir al carrito. Es el diferenciador #1 del mercado y el mayor reductor de abandono.
2. **Formulario de destinatario adaptado a Cuba.** CI con validación en tiempo real, provincia/municipio, tooltip explicando el porqué del CI ("requerido por la aduana cubana").
3. **Checkout en 4 pasos con progreso visible** y resumen siempre presente → reduce fricción y ansiedad.
4. **Tracking sin login** (solo # de orden) con timeline de 6 estados específicos del corredor (compra EE.UU. → almacén Miami → vuelo → aduana → entrega).
5. **Estados loading / empty / error** simulados en catálogo, tracking, carrito y checkout.
6. **Coherencia con el ecosistema:** mismos tokens, fuentes, naranja+azul, dark-first, glow sutil en hover, easing `[0.16,1,0.3,1]`.
7. **Accesibilidad:** skip-link, focus visible, `aria-label` en iconos, contraste AA, `prefers-reduced-motion`, touch targets ≥40px.

## Nota

Demo de validación. No procesa pagos reales ni envía datos a ningún servidor.
```
```
