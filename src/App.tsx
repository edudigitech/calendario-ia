import type { Session } from '@supabase/supabase-js'
import {
  addDays,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import MonthGrid from './components/MonthGrid'
import PlanInput from './components/PlanInput'
import TimeGrid from './components/TimeGrid'
import { WEEK_OPTS, shiftCursor, timeZone, visibleRange } from './lib/dates'
import { EVENTS_TABLE, supabase } from './lib/supabase'
import type { CalendarEvent, EventDraft, ViewMode } from './lib/types'

type Theme = 'light' | 'dark'

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export default function App() {
  const [view, setView] = useState<ViewMode>('week')
  const [cursor, setCursor] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  const [session, setSession] = useState<Session | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const userId = session?.user.id ?? null

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setCheckingAuth(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setCheckingAuth(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* modo privado: se ignora */
    }
  }, [theme])

  const reload = useCallback(async () => {
    if (!userId) {
      setEvents([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { from, to } = visibleRange(view, cursor)
    const { data, error } = await supabase
      .from(EVENTS_TABLE)
      .select('*')
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at', { ascending: true })

    if (error) {
      console.error(error)
      setToast(`Error al cargar: ${error.message}`)
    } else {
      setEvents((data ?? []) as CalendarEvent[])
    }
    setLoading(false)
  }, [view, cursor, userId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const days = useMemo(() => {
    if (view === 'day') return [startOfDay(cursor)]
    const first = startOfWeek(cursor, WEEK_OPTS)
    return Array.from({ length: 7 }, (_, i) => addDays(first, i))
  }, [view, cursor])

  const title = useMemo(() => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    if (view === 'day') {
      return cap(format(cursor, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }))
    }
    if (view === 'week') {
      const first = startOfWeek(cursor, WEEK_OPTS)
      const last = addDays(first, 6)
      return `${format(first, 'd MMM', { locale: es })} – ${format(last, "d MMM 'de' yyyy", { locale: es })}`
    }
    return cap(format(cursor, "MMMM 'de' yyyy", { locale: es }))
  }, [view, cursor])

  async function handlePlan(text: string): Promise<number> {
    if (!session) {
      throw new Error('Tu sesión ha caducado. Vuelve a entrar.')
    }

    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        text,
        now: new Date().toISOString(),
        timeZone: timeZone(),
      }),
    })

    const json = (await res.json()) as {
      events?: EventDraft[]
      error?: string
    }

    if (!res.ok) throw new Error(json.error ?? 'Error del servidor')

    const drafts = json.events ?? []
    if (drafts.length === 0) {
      throw new Error('No he encontrado ningún evento en ese texto.')
    }

    const rows = drafts.map((d) => ({
      ...d,
      source_text: text,
      user_id: session.user.id,
    }))
    const { error } = await supabase.from(EVENTS_TABLE).insert(rows)
    if (error) throw new Error(error.message)

    // Si lo creado cae fuera del periodo que se está viendo, salta hasta ahí.
    const range = visibleRange(view, cursor)
    const times = drafts.map((d) => new Date(d.starts_at).getTime())
    const outOfView = times.some(
      (t) => t < range.from.getTime() || t >= range.to.getTime(),
    )
    if (outOfView) setCursor(new Date(Math.min(...times)))

    await reload()
    setToast(
      drafts.length === 1
        ? 'Añadido 1 evento a tu calendario'
        : `Añadidos ${drafts.length} eventos a tu calendario`,
    )
    return drafts.length
  }

  async function removeEvent(event: CalendarEvent) {
    if (!window.confirm(`¿Eliminar "${event.title}"?`)) return
    const { error } = await supabase
      .from(EVENTS_TABLE)
      .delete()
      .eq('id', event.id)
    if (error) {
      setToast(`Error al eliminar: ${error.message}`)
      return
    }
    await reload()
    setToast('Evento eliminado')
  }

  if (checkingAuth) {
    return <div className="splash">Cargando…</div>
  }

  if (!session) {
    return (
      <AuthScreen
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
        }
      />
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          Calendario IA
        </div>

        <div className="toolbar">
          <button className="ghost" onClick={() => setCursor(new Date())}>
            Hoy
          </button>
          <button
            className="ghost icon"
            aria-label="Anterior"
            onClick={() => setCursor((c) => shiftCursor(view, c, -1))}
          >
            ‹
          </button>
          <button
            className="ghost icon"
            aria-label="Siguiente"
            onClick={() => setCursor((c) => shiftCursor(view, c, 1))}
          >
            ›
          </button>
          <button
            className="ghost icon"
            aria-label={
              theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
            }
            title={
              theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
            }
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        <div className="segmented">
          {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
            <button
              key={v}
              className={view === v ? 'active' : ''}
              onClick={() => setView(v)}
            >
              {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <div className="userbox">
          <span className="user-email" title={session.user.email ?? ''}>
            {session.user.email}
          </span>
          <button
            className="ghost"
            onClick={() => void supabase.auth.signOut()}
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="layout">
        <main className="calendar">
          <h1 className="period">{title}</h1>
          {loading && <div className="loading">Cargando…</div>}

          {view === 'month' ? (
            <MonthGrid
              cursor={cursor}
              events={events}
              onSelectEvent={removeEvent}
              onSelectDay={(day) => {
                setCursor(day)
                setView('day')
              }}
            />
          ) : (
            <TimeGrid days={days} events={events} onSelect={removeEvent} />
          )}

          {!loading && events.length === 0 && (
            <p className="empty">
              No hay eventos en este periodo. Escribe tu planning en el panel y
              la IA lo colocará aquí.
            </p>
          )}
        </main>

        <aside className="side">
          <PlanInput onSubmit={handlePlan} />
          <p className="tip">
            Consejo: pulsa un evento del calendario para eliminarlo.
          </p>
        </aside>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
