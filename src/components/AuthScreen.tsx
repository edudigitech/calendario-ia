import { useState } from 'react'
import type { FormEvent } from 'react'
import { authErrorMessage } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

interface Props {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function AuthScreen({ theme, onToggleTheme }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    setError(null)
    setNotice(null)
    setBusy(true)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        // Si el proyecto exige confirmar el correo, no hay sesión todavía.
        if (!data.session) {
          setNotice(
            'Cuenta creada. Te hemos enviado un correo con un enlace de confirmación; después ya podrás entrar.',
          )
          setMode('login')
          setPassword('')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(authErrorMessage(message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-theme">
        <button
          className="ghost icon"
          aria-label={
            theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
          }
          title={
            theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
          }
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-dot" />
          Calendario IA
        </div>

        <h1>{mode === 'login' ? 'Entra en tu calendario' : 'Crea tu cuenta'}</h1>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Tus planings son solo tuyos: cada cuenta ve únicamente sus eventos.'
            : 'Con una cuenta tendrás tu propio calendario, separado del de cualquier otra persona.'}
        </p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Crear cuenta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="panel-error">{error}</p>}
          {notice && <p className="auth-ok">{notice}</p>}

          <button className="primary" type="submit" disabled={busy}>
            {busy
              ? 'Un momento…'
              : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-hint">
          Si acabas de crear la cuenta y no puedes entrar, puede que falte
          confirmar el email. Mira en spam antes de darte por vencido.
        </p>
      </div>
    </div>
  )
}
