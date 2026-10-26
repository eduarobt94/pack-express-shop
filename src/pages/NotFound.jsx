import Button from '../components/ui/Button'
import { Reveal } from '../components/ui/Layout'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center">
      <div className="container-x py-24">
        <Reveal>
          <p className="eyebrow mb-8">Error 404</p>
          <h1 className="display text-[var(--fg-1)]">Página no encontrada</h1>
          <p className="lead mt-8 max-w-[44ch]">
            La página que buscás no existe o fue movida. Volvamos a un lugar seguro.
          </p>
          <div className="mt-12 flex flex-wrap gap-4">
            <Button to="/" size="lg">Volver al inicio</Button>
            <Button to="/catalogo" variant="outline" size="lg">Ver catálogo</Button>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
