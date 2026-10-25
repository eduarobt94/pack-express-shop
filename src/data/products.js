// Catálogo orientativo — datos de ejemplo hardcodeados.
// Precios y disponibilidad son de terceros (tiendas de EE.UU.) y pueden cambiar.
// PENDIENTE DE OPTIMUS: aprobar cada artículo antes de publicarlo y verificar el
// peso embalado (weightKg es el peso del equipo solo, no el embalado).
export const products = [
  {
    "id": "ef-delta-2-max",
    "name": "EcoFlow DELTA 2 Max",
    "brand": "EcoFlow",
    "category": "energia-respaldo",
    "price": 1099,
    "weightKg": 23,
    "icon": "BatteryCharging",
    "tint": "#E31E24",
    "tagline": "2048 Wh · Respaldo para toda la casa",
    "short": "Estación de energía portátil con 2048 Wh ampliables a 6144 Wh. Carga del 0 al 80% en 43 minutos.",
    "highlights": [
      "Capacidad 2048 Wh (ampliable a 6144 Wh)",
      "Salida AC de 2400 W (pico 4800 W)",
      "Recarga solar de hasta 1000 W",
      "App EcoFlow con control remoto"
    ],
    "specs": {
      "Capacidad": "2048 Wh",
      "Salida AC": "2400 W (pico 4800 W)",
      "Tiempo de carga": "0–80% en 43 min",
      "Ciclos de vida": "3000+ (LFP)",
      "Peso": "23 kg",
      "Garantía": "5 años"
    },
    "gallery": [
      "#E31E24",
      "#C81A1F",
      "#1A1A1A"
    ],
    "store": "Amazon",
    "updatedAt": "2026-10-25",
    "approved": false
  },
  {
    "id": "ef-river-2-pro",
    "name": "EcoFlow RIVER 2 Pro",
    "brand": "EcoFlow",
    "category": "energia-respaldo",
    "price": 539,
    "weightKg": 7.8,
    "icon": "BatteryCharging",
    "tint": "#E31E24",
    "tagline": "768 Wh · Compacta y potente",
    "short": "Estación de energía compacta de 768 Wh, ideal para respaldo de equipos esenciales.",
    "highlights": [
      "Capacidad 768 Wh",
      "Salida AC de 800 W",
      "Recarga completa en 70 minutos",
      "Ultraligera: 7.8 kg"
    ],
    "specs": {
      "Capacidad": "768 Wh",
      "Salida AC": "800 W",
      "Tiempo de carga": "0–100% en 70 min",
      "Ciclos de vida": "3000+ (LFP)",
      "Peso": "7.8 kg",
      "Garantía": "5 años"
    },
    "gallery": [
      "#E31E24",
      "#C85A28",
      "#1A1A1A"
    ],
    "store": "Amazon",
    "updatedAt": "2026-10-25",
    "approved": false
  },
  {
    "id": "ecoflow-panel-400",
    "name": "EcoFlow Panel Solar 400W",
    "brand": "EcoFlow",
    "category": "energia-respaldo",
    "price": 599,
    "weightKg": 16,
    "icon": "Cable",
    "tint": "#A8A8A8",
    "tagline": "Panel plegable · 23% eficiencia",
    "short": "Panel solar portátil de 400 W con 23% de eficiencia, ideal para recargar power stations.",
    "highlights": [
      "Potencia de 400 W",
      "Eficiencia del 23%",
      "Diseño plegable y resistente IP68",
      "Compatible con toda la gama EcoFlow"
    ],
    "specs": {
      "Potencia": "400 W",
      "Eficiencia": "23%",
      "Resistencia": "IP68",
      "Conector": "MC4 / XT60",
      "Peso": "16 kg",
      "Garantía": "2 años"
    },
    "gallery": [
      "#A8A8A8",
      "#6E6E6E",
      "#1A1A1A"
    ],
    "store": "Amazon",
    "updatedAt": "2026-10-25",
    "approved": false
  },
  {
    "id": "anker-757",
    "name": "Anker 757 PowerHouse",
    "brand": "Anker",
    "category": "energia-respaldo",
    "price": 999,
    "weightKg": 19.9,
    "icon": "BatteryCharging",
    "tint": "#E31E24",
    "tagline": "1229 Wh · LiFePO4",
    "short": "Estación de energía de 1229 Wh con baterías LiFePO4 de larga duración.",
    "highlights": [
      "Capacidad 1229 Wh",
      "Salida AC de 1500 W",
      "Baterías LiFePO4 (10 años)",
      "13 puertos de salida"
    ],
    "specs": {
      "Capacidad": "1229 Wh",
      "Salida AC": "1500 W",
      "Tiempo de carga": "0–80% en 1 h",
      "Ciclos de vida": "3000+ (LFP)",
      "Peso": "19.9 kg",
      "Garantía": "5 años"
    },
    "gallery": [
      "#E31E24",
      "#C85A28",
      "#1A1A1A"
    ],
    "store": "Amazon",
    "updatedAt": "2026-10-25",
    "approved": false
  }
]

export const getProduct = (id) => products.find((p) => p.id === id)

export const featuredProducts = products
