import { motion } from 'framer-motion'
import { PackageX } from 'lucide-react'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="pt-0 min-h-screen flex items-center justify-center px-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#E31E24]/[0.10] border border-[#E31E24]/25 flex items-center justify-center mx-auto mb-6">
          <PackageX size={36} className="text-[#E31E24]" />
        </div>
        <div className="font-display font-extrabold text-6xl text-[var(--fg-1)] mb-2">404</div>
        <h1 className="font-display font-bold text-xl text-[var(--fg-1)] mb-2">Página no encontrada</h1>
        <p className="text-[14px] text-[var(--fg-3)] max-w-sm mx-auto mb-8">
          La página que buscas no existe o fue movida. Volvamos a un lugar seguro.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button to="/">Volver al inicio</Button>
          <Button to="/catalogo" variant="outline">Ver catálogo</Button>
        </div>
      </motion.div>
    </div>
  )
}
