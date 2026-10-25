// Categorías de la tienda — datos hardcodeados para validación de UX
export const categories = [
  {
    slug: 'estaciones-energia',
    name: 'Estaciones de Energía',
    short: 'Energía portátil',
    description: 'Power stations EcoFlow y generadores solares para respaldo total ante apagones.',
    icon: 'BatteryCharging',
    accent: '#E31E24',
    count: 12,
  },
  {
    slug: 'movilidad-electrica',
    name: 'Movilidad Eléctrica',
    short: 'Bicicletas e-bikes',
    description: 'Bicicletas y scooters eléctricos para moverte por la ciudad sin gasolina.',
    icon: 'Bike',
    accent: '#A8A8A8',
    count: 9,
  },
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    short: 'Tech & gadgets',
    description: 'Laptops, smartphones, tablets y equipos de las mejores marcas de EE.UU.',
    icon: 'Laptop',
    accent: '#A8A8A8',
    count: 24,
  },
  {
    slug: 'hogar',
    name: 'Hogar Inteligente',
    short: 'Smart home',
    description: 'Electrodomésticos, climatización y dispositivos para un hogar conectado.',
    icon: 'House',
    accent: '#E31E24',
    count: 18,
  },
  {
    slug: 'accesorios',
    name: 'Accesorios',
    short: 'Complementos',
    description: 'Paneles solares, baterías extra, cargadores y accesorios de alto valor.',
    icon: 'Cable',
    accent: '#A8A8A8',
    count: 31,
  },
]

export const getCategory = (slug) => categories.find((c) => c.slug === slug)
