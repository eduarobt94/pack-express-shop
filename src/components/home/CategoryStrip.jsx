import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { categories } from '../../data/categories'

export default function CategoryStrip() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
      <h2 className="font-display font-bold text-[18px] sm:text-xl text-[var(--fg-1)] mb-4">Tiendas y productos útiles para el hogar en Cuba</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {categories.map((cat, i) => {
          const Icon = Icons[cat.icon] || Icons.Package
          return (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.25) }}
            >
              <Link
                to={`/catalogo?cat=${cat.slug}`}
                className="group flex flex-col items-center text-center gap-2.5 p-4 rounded-2xl card-surface hover:border-[var(--bd-3)] hover:shadow-[var(--shadow-hover)] transition-all duration-300 h-full"
              >
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                  style={{ background: `${cat.accent}1A`, border: `1px solid ${cat.accent}33` }}
                >
                  <Icon size={24} style={{ color: cat.accent }} />
                </div>
                <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-[var(--fg-1)] leading-tight">{cat.short}</span>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
