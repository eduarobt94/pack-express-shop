import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'backend/**', 'api/**', 'database/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Regla de estilo del React Compiler (no de corrección): se informa sin bloquear; cambiar estos efectos arriesga regresiones de comportamiento.
      'react-hooks/set-state-in-effect': 'warn',
      'react/jsx-uses-vars': 'error', // evita falsos "no-unused-vars" con componentes JSX
      'react/jsx-uses-react': 'off',
      'react/jsx-no-target-blank': 'error', // enlaces target=_blank sin rel=noopener
      'react/jsx-key': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  { files: ['tests/**', 'e2e/**', '*.config.js'], languageOptions: { globals: { ...globals.node, ...globals.vitest } } },
]
