// Categorías propuestas en el alcance. Optimus aprobará los artículos admitidos antes de publicarlos.
export const categories = [
  {
    slug: 'energia-respaldo',
    name: 'Energía y respaldo eléctrico',
    short: 'Energía y respaldo',
    description: 'Estaciones de energía, baterías y accesorios para tener luz cuando falta.',
    icon: 'BatteryCharging',
    accent: '#E31E24',
  },
  {
    slug: 'iluminacion',
    name: 'Iluminación recargable y solar',
    short: 'Iluminación',
    description: 'Lámparas y luces recargables o solares para el hogar.',
    icon: 'Lightbulb',
    accent: '#A8A8A8',
  },
  {
    slug: 'ventiladores',
    name: 'Ventiladores recargables',
    short: 'Ventiladores',
    description: 'Ventiladores con batería para los días sin corriente.',
    icon: 'Fan',
    accent: '#E31E24',
  },
  {
    slug: 'cocina',
    name: 'Cocina y utensilios',
    short: 'Cocina',
    description: 'Utensilios y equipos de cocina útiles para el hogar.',
    icon: 'CookingPot',
    accent: '#A8A8A8',
  },
  {
    slug: 'agua',
    name: 'Agua y filtración',
    short: 'Agua y filtros',
    description: 'Filtros y soluciones para tener agua segura.',
    icon: 'Droplets',
    accent: '#E31E24',
  },
  {
    slug: 'herramientas',
    name: 'Herramientas y repuestos',
    short: 'Herramientas',
    description: 'Herramientas y repuestos para reparar y mantener.',
    icon: 'Wrench',
    accent: '#A8A8A8',
  },
  {
    slug: 'comunicacion',
    name: 'Comunicación y accesorios',
    short: 'Comunicación',
    description: 'Radios, cargadores, cables y accesorios.',
    icon: 'Cable',
    accent: '#E31E24',
  },
]

export const getCategory = (slug) => categories.find((c) => c.slug === slug)
