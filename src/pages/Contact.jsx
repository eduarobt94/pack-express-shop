import { MapPin, Clock, MessageCircle, Mail, FileText } from 'lucide-react'

const FAQ = [
  { q: '¿Pago el producto a Optimus?', a: 'No. El producto se paga en la tienda con tus medios de pago. A Optimus le pagás en la sucursal la comisión y el envío.' },
  { q: '¿La aduana está incluida?', a: 'No. La paga el destinatario en Cuba al recibir el paquete.' },
  { q: '¿Tengo que registrar mi compra?', a: 'Sí. La tienda no nos informa qué compraste, así que el registro con comprobante es obligatorio.' },
  { q: '¿Cuándo despachan?', a: 'Cuando el cliente, el destinatario y los paquetes están identificados, el producto está aprobado y la liquidación final está pagada.' },
  { q: '¿Qué productos se admiten?', a: 'Optimus aprueba los artículos antes de publicarlos. Baterías, paneles, generadores y equipos voluminosos se confirman caso por caso.' },
]

const PENDING = ['Cancelaciones', 'Almacenamiento', 'Paquetes no identificados', 'Falta de pago', 'Pérdida, daño y seguro', 'Reclamos y devoluciones', 'Privacidad y datos personales']

export default function Contact() {
  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
      <h1 className="font-display font-black text-[clamp(1.75rem,4vw,3rem)] text-[var(--fg-1)] leading-tight mb-8">Contacto y condiciones</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        <Card Icon={MapPin} title="Sucursal en Uruguay" text="[DIRECCIÓN DE LA SUCURSAL]" />
        <Card Icon={Clock} title="Horarios" text="[HORARIOS DE ATENCIÓN]" />
        <Card Icon={MessageCircle} title="WhatsApp" text="[WHATSAPP]" />
        <Card Icon={Mail} title="Correo" text="[EMAIL]" />
      </div>

      <h2 className="font-display font-extrabold text-2xl text-[var(--fg-1)] mb-4">Preguntas frecuentes</h2>
      <div className="space-y-3 mb-12">
        {FAQ.map((f) => (
          <details key={f.q} className="card-surface rounded-xl p-5 group">
            <summary className="font-display font-extrabold text-[15px] text-[var(--fg-1)] cursor-pointer list-none flex justify-between gap-4">
              {f.q}
              <span className="text-[#E31E24] group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="text-[13.5px] text-[var(--fg-3)] mt-3 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className="font-display font-extrabold text-2xl text-[var(--fg-1)] mb-4 flex items-center gap-2">
        <FileText size={22} className="text-[#E31E24]" /> Condiciones del servicio
      </h2>
      <div className="card-surface rounded-xl p-6 text-[13.5px] text-[var(--fg-3)] leading-relaxed">
        <p className="mb-3">Las condiciones comerciales todavía no están aprobadas por Optimus y no se publican como definitivas. Quedan por definir:</p>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 list-disc pl-5">
          {PENDING.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </div>
    </div>
  )
}

function Card({ Icon, title, text }) {
  return (
    <div className="card-surface rounded-xl p-5 flex gap-4">
      <div className="w-11 h-11 rounded-lg bg-[#E31E24]/[0.10] border border-[#E31E24]/25 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-[#E31E24]" />
      </div>
      <div>
        <h3 className="font-display font-extrabold text-[14.5px] text-[var(--fg-1)]">{title}</h3>
        <p className="text-[13px] text-[var(--fg-3)] mt-1 font-mono">{text}</p>
      </div>
    </div>
  )
}
