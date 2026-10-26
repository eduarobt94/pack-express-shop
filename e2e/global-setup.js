// Recrea la base de datos de PRUEBAS e2e (nunca toca otra base) y aplica las migraciones versionadas.
import { execFileSync } from 'node:child_process'
import { E2E_ENV } from '../playwright.config.js'

export default async function globalSetup() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = E2E_ENV
  if (!DB_NAME.endsWith('_test')) throw new Error(`E2E_DB_NAME debe terminar en _test (recibido: ${DB_NAME})`)
  const env = { ...process.env, DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME }
  const php = process.env.PHP_BIN ?? 'php'
  const recreate = `$p=new PDO('mysql:host='.getenv('DB_HOST').';port='.getenv('DB_PORT'),getenv('DB_USER'),getenv('DB_PASS'));`
    + `$p->exec('DROP DATABASE IF EXISTS \`'.getenv('DB_NAME').'\`');$p->exec('CREATE DATABASE \`'.getenv('DB_NAME').'\` CHARACTER SET utf8mb4');`
  try {
    execFileSync(php, ['-r', recreate], { env, stdio: 'pipe' })
    execFileSync(php, ['database/migrate.php', 'up'], { env, stdio: 'pipe' })
  } catch (e) {
    throw new Error(`No se pudo preparar la base e2e (infraestructura, no producto): ${e.stderr?.toString() ?? e.message}`, { cause: e })
  }
}
