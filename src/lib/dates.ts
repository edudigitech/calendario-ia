import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { ViewMode } from './types'

export const WEEK_OPTS = { weekStartsOn: 1 as const }

export const LOCALE = 'es-ES'

export function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
}

/** Rango visible (con margen) para pedir solo los eventos que se muestran. */
export function visibleRange(view: ViewMode, cursor: Date) {
  if (view === 'day') {
    return { from: cursor, to: addDays(cursor, 1) }
  }
  if (view === 'week') {
    return {
      from: startOfWeek(cursor, WEEK_OPTS),
      to: addDays(endOfWeek(cursor, WEEK_OPTS), 1),
    }
  }
  return {
    from: startOfWeek(startOfMonth(cursor), WEEK_OPTS),
    to: addDays(endOfWeek(endOfMonth(cursor), WEEK_OPTS), 1),
  }
}

export function shiftCursor(view: ViewMode, cursor: Date, delta: number): Date {
  if (view === 'day') return addDays(cursor, delta)
  if (view === 'week') return addDays(cursor, delta * 7)
  return addMonths(cursor, delta)
}

/** 1 px por minuto: útil para posicionar eventos en la rejilla horaria. */
export const MINUTES_PER_DAY = 1440
export const PX_PER_MINUTE = 1

export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function clampMinutes(date: Date, dayStart: Date, dayEnd: Date): number {
  if (date <= dayStart) return 0
  if (date >= dayEnd) return MINUTES_PER_DAY
  return minutesFromMidnight(date)
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
