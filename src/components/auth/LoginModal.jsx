import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, Eye, EyeOff, Warehouse, AlertCircle, Loader2, User, Phone, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function LoginModal({ open, onClose, onSuccess, closeable = true, initialMode = 'login' }) {
  const { login, register, forgotPassword, loading, error, clearError } = useAuth()
  const [mode, setMode]         = useState('login') // 'login' | 'register'
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [sent, setSent]         = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const firstRef = useRef(null)

  useEffect(() => {
    if (open) {
      clearError()
      setMode(initialMode); setSent(false)
      setName(''); setEmail(''); setPhone(''); setPassword(''); setConfirm('')
      setTimeout(() => firstRef.current?.focus(), 80)
    }
  }, [open, clearError, initialMode])

  useEffect(() => {
    if (!open || !closeable) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, closeable])

  function switchMode(m) {
    clearError()
    setMode(m)
    setSent(false)
    setName(''); setEmail(''); setPhone(''); setPassword(''); setConfirm(''); setShowPw(false)
    setTimeout(() => firstRef.current?.focus(), 60)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (mode === 'register' && password !== confirm) return
    if (mode === 'forgot') {
      try {
        await forgotPassword(email.trim())
        setSent(true)
      } catch {
        // error mostrado en el banner por el contexto
      }
      return
    }
    try {
      const user = mode === 'login'
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password, phone.trim())
      onSuccess?.(user)
      onClose()
    } catch {
      // error shown in banner via context
    }
  }

  const passwordMismatch = mode === 'register' && confirm && password !== confirm

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeable ? onClose : undefined}
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-title"
              className="pointer-events-auto w-full max-w-sm bg-[var(--bg-base)] border border-[var(--bd-2)] rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[var(--bd-1)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--sec)]/[0.1] flex items-center justify-center">
                    <Warehouse size={18} className="text-[var(--sec)]" />
                  </div>
                  <div>
                    <p id="login-title" className="font-bold text-[15px] text-[var(--fg-1)]">
                      {mode === 'login' ? 'Acceder al Casillero' : mode === 'forgot' ? 'Recuperar contraseña' : 'Crear cuenta'}
                    </p>
                    <p className="text-[12px] text-[var(--fg-4)]">
                      {mode === 'login' ? 'Ingresa con tu cuenta Optimus Envíos' : mode === 'forgot' ? 'Te enviamos un enlace por correo' : 'Es gratis y toma 1 minuto'}
                    </p>
                  </div>
                </div>
                {closeable && (
                  <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--fg-4)] hover:text-[var(--fg-1)] hover:bg-[var(--bd-1)] transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3.5">
                {/* Error banner */}
                <AnimatePresence>
                  {(error || passwordMismatch) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 bg-[#EF4444]/[0.08] border border-[#EF4444]/20 rounded-xl px-3 py-2.5 text-[13px] text-[var(--err-text)]"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      {passwordMismatch ? 'Las contraseñas no coinciden' : error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Name (register only) */}
                <AnimatePresence>
                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label htmlFor="login-name" className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide">
                        Nombre completo
                      </label>
                      <div className="flex items-center gap-2 h-11 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] px-3 focus-within:border-[var(--color-brand)] focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all">
                        <User size={15} className="text-[var(--fg-4)] shrink-0" />
                        <input
                          id="login-name"
                          ref={mode === 'register' ? firstRef : null}
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Tu nombre completo"
                          required={mode === 'register'}
                          autoComplete="name"
                          className="flex-1 bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide">
                    Correo electrónico
                  </label>
                  <div className="flex items-center gap-2 h-11 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] px-3 focus-within:border-[var(--color-brand)] focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all">
                    <Mail size={15} className="text-[var(--fg-4)] shrink-0" />
                    <input
                          id="login-email"
                      ref={mode !== 'register' ? firstRef : null}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tucorreo@email.com"
                      required
                      autoComplete="email"
                      className="flex-1 bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
                    />
                  </div>
                </div>

                {/* Teléfono (solo registro): la cuenta lo exige para coordinar la entrega y el cobro */}
                <AnimatePresence>
                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label htmlFor="login-phone" className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide">
                        Teléfono
                      </label>
                      <div className="flex items-center gap-2 h-11 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] px-3 focus-within:border-[var(--color-brand)] focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all">
                        <Phone size={15} className="text-[var(--fg-4)] shrink-0" />
                        <input
                          id="login-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+598 99 123 456"
                          required
                          maxLength={30}
                          autoComplete="tel"
                          inputMode="tel"
                          className="flex-1 bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {mode !== 'forgot' && (
                  <>
                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide">
                    Contraseña
                  </label>
                  <div className="flex items-center gap-2 h-11 rounded-xl border border-[var(--bd-2)] bg-[var(--bg-card)] px-3 focus-within:border-[var(--color-brand)] focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all">
                    <Lock size={15} className="text-[var(--fg-4)] shrink-0" />
                    <input
                          id="login-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="flex-1 bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="text-[var(--fg-4)] hover:text-[var(--fg-2)] transition-colors cursor-pointer"
                      aria-label={showPw ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                  </>
                )}

                {/* Confirm password (register only) */}
                <AnimatePresence>
                  {mode === 'register' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1.5 overflow-hidden"
                    >
                      <label htmlFor="login-confirm" className="text-[12px] font-semibold text-[var(--fg-3)] uppercase tracking-wide">
                        Confirmar contraseña
                      </label>
                      <div className={`flex items-center gap-2 h-11 rounded-xl border bg-[var(--bg-card)] px-3 focus-within:shadow-[0_0_0_3px_rgba(227,30,36,0.12)] transition-all ${
                        passwordMismatch ? 'border-[#EF4444]/60' : 'border-[var(--bd-2)] focus-within:border-[var(--color-brand)]'
                      }`}>
                        <Lock size={15} className="text-[var(--fg-4)] shrink-0" />
                        <input
                          id="login-confirm"
                          type={showPw ? 'text' : 'password'}
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          placeholder="Repite la contraseña"
                          required={mode === 'register'}
                          autoComplete="new-password"
                          className="flex-1 bg-transparent text-sm text-[var(--fg-1)] placeholder-[var(--fg-4)] outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {sent && (
                  <p role="status" className="flex items-start gap-2 bg-[#22C55E]/[0.08] border border-[#22C55E]/20 rounded-xl px-3 py-2.5 text-[13px] text-[var(--ok-text)]">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    Si el correo existe, te enviamos las instrucciones para restablecer tu contraseña. El enlace vale 1 hora.
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || passwordMismatch || sent}
                  className="w-full h-11 rounded-xl bg-[var(--sec)] hover:bg-[#4570CC] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> {mode === 'login' ? 'Ingresando…' : mode === 'forgot' ? 'Enviando…' : 'Creando cuenta…'}</>
                    : mode === 'login' ? 'Ingresar' : mode === 'forgot' ? 'Enviar enlace' : 'Crear cuenta gratis'}
                </button>

                {/* Toggle */}
                <p className="text-center text-[12px] text-[var(--fg-4)]">
                  {mode === 'forgot' ? (
                    <button type="button" onClick={() => switchMode('login')} className="text-[var(--sec)] font-semibold hover:underline cursor-pointer">
                      Volver a ingresar
                    </button>
                  ) : mode === 'login' ? (
                    <>
                      <button type="button" onClick={() => switchMode('forgot')} className="block mx-auto mb-3 text-[var(--sec)] font-semibold hover:underline cursor-pointer">
                        ¿Olvidaste tu contraseña?
                      </button>
                      ¿No tienes cuenta?{' '}
                      <button type="button" onClick={() => switchMode('register')} className="text-[var(--sec)] font-semibold hover:underline cursor-pointer">
                        Regístrate gratis
                      </button>
                    </>
                  ) : (
                    <>¿Ya tienes cuenta?{' '}
                      <button type="button" onClick={() => switchMode('login')} className="text-[var(--sec)] font-semibold hover:underline cursor-pointer">
                        Ingresar
                      </button>
                    </>
                  )}
                </p>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
