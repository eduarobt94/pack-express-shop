// Solo se enlazan URLs http(s). Evita esquemas peligrosos (javascript:, data:) si un dato externo
// (respuesta de un proxy de marketplace) llega alterado.
export function safeUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}
