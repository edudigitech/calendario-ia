import { endOfDay, format } from 'date-fns'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORIES } from '../lib/types'
import type { CalendarEvent, Category, EventUpdate } from '../lib/types'

interface Props {
  event: CalendarEvent
  onClose: () => void
  onSave: (id: string, patch: EventUpdate) => Promise<void>
  onDelete: (event: CalendarEvent) => Promise<void>
}

/** `2026-10-21` + `08:30` → Date en hora local (sin sorpresas de zona). */
function localDate(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = (timeStr || '00:00').split(':').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0)
}

export default function EventDialog({ event, onClose, onSave, onDelete }: Props) {
  const start = new Date(event.starts_at)
  const end = new Date(event.ends_at)

  const [title, setTitle] = useState(event.title)
  const [notes, setNotes] = useState(event.notes ?? '')
  const [allDay, setAllDay] = useState(event.all_day)
  const [startDate, setStartDate] = useState(format(start, 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState(format(start, 'HH:mm'))
  const [endDate, setEndDate] = useState(format(end, 'yyyy-MM-dd'))
  const [endTime, setEndTime] = useState(format(end, 'HH:mm'))
  const [category, setCategory] = useState<Category>(event.category)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    function onKey(event_: KeyboardEvent) {
      if (event_.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    if (busy) return

    setError(null)

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      setError('El evento necesita un nombre.')
      return
    }
    if (!startDate || !endDate) {
      setError('Faltan la fecha de inicio o la de fin.')
      return
    }

    const starts = localDate(startDate, allDay ? '00:00' : startTime)
    const ends = allDay
      ? endOfDay(localDate(endDate, '00:00'))
      : localDate(endDate, endTime)

    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      setError('Las fechas no son válidas.')
      return
    }
    if (ends <= starts) {
      setError('El final tiene que ser posterior al inicio.')
      return
    }

    setBusy(true)
    try {
      await onSave(event.id, {
        title: cleanTitle,
        notes: notes.trim() ? notes.trim() : null,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        all_day: allDay,
        category,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await onDelete(event)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setBusy(false)
    }
  }

  return (
    <div
      className="modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
      >
        <div className="modal-head">
          <h2 id="event-dialog-title">Editar evento</h2>
          <button
            type="button"
            className="ghost icon"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="ev-title">Nombre</label>
            <input
              id="ev-title"
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            Todo el día
          </label>

          <div className="modal-grid">
            <div className="field">
              <label htmlFor="ev-start-date">Fecha de inicio</label>
              <input
                id="ev-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-start-time">Hora</label>
              <input
                id="ev-start-time"
                type="time"
                value={startTime}
                disabled={allDay}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-end-date">Fecha de fin</label>
              <input
                id="ev-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ev-end-time">Hora</label>
              <input
                id="ev-end-time"
                type="time"
                value={endTime}
                disabled={allDay}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ev-category">Categoría</label>
            <select
              id="ev-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="ev-notes">Notas (opcional)</label>
            <textarea
              id="ev-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="panel-error">{error}</p>}

          <div className="modal-actions">
            {confirmDelete ? (
              <button
                type="button"
                className="danger"
                onClick={() => void handleDelete()}
                disabled={busy}
              >
                ¿Eliminar definitivamente?
              </button>
            ) : (
              <button
                type="button"
                className="danger-quiet"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Eliminar
              </button>
            )}

            <span className="spacer" />

            <button
              type="button"
              className="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
