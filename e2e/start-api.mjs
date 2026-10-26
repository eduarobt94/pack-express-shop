// Lanza el backend FastAPI para las pruebas E2E sin depender del intérprete de comandos (cmd, PowerShell o sh).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const candidates = [
  process.env.E2E_PYTHON,
  path.join(root, 'backend', '.venv', 'Scripts', 'python.exe'),
  path.join(root, 'backend', '.venv', 'bin', 'python'),
].filter(Boolean)
const python = candidates.find((p) => existsSync(p)) ?? 'python'
const port = process.env.E2E_API_PORT ?? '8310'

const child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--port', port, '--log-level', 'warning', '--no-proxy-headers'], {
  cwd: path.join(root, 'backend'),
  stdio: 'inherit',
  env: process.env,
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill())
child.on('exit', (code) => process.exit(code ?? 0))
