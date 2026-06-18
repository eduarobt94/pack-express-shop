const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

function getToken() {
  return localStorage.getItem('pkx_token')
}

async function request(method, path, body, isFormData = false) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => ({ success: false, message: 'Error de red' }))

  if (!res.ok) {
    const err = new Error(json.message ?? 'Error desconocido')
    err.status = res.status
    err.errors = json.errors
    throw err
  }

  return json
}

export const api = {
  get:    (path)              => request('GET',    path),
  post:   (path, body)        => request('POST',   path, body),
  put:    (path, body)        => request('PUT',    path, body),
  delete: (path)              => request('DELETE', path),
  upload: (path, formData)    => request('POST',   path, formData, true),
}
