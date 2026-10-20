import { addDays, format, isSameDay, isToday, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import {
  MINUTES_PER_DAY,
  PX_PER_MINUTE,
  clampMinutes,
  formatTime,
  minutesFromMidnight,
} from '../lib/dates'
import type { CalendarEvent } from '../lib/types'

interface Props {
  days: Date[]
  events: CalendarEvent[]
  onSelect: (event: CalendarEvent) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function TimeGrid({ days, events, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * 60
  }, [])

  const allDay = events.filter((e) => e.all_day)

  return (
    <div
      className="timegrid"
      style={{ '--cols': days.length } as CSSProperties}
    >
      <div className="timegrid-head">
        <div className="gutter" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`day-head${isToday(day) ? ' is-today' : ''}`}
          >
            <span className="day-name">
              {format(day, 'EEE', { locale: es })}
            </span>
            <span className="day-num">{format(day, 'd')}</span>
          </div>
        ))}
      </div>

      {allDay.length > 0 && (
        <div className="timegrid-allday">
          <div className="gutter all-day-label">todo el día</div>
          {days.map((day) => (
            <div key={day.toISOString()} className="all-day-cell">
              {allDay
                .filter((e) => isSameDay(new Date(e.starts_at), day))
                .map((e) => (
                  <button
                    key={e.id}
                    className={`chip cat-${e.category}`}
                    onClick={() => onSelect(e)}
                  >
                    {e.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="timegrid-scroll" ref={scroller}>
        <div
          className="timegrid-body"
          style={{ height: MINUTES_PER_DAY * PX_PER_MINUTE }}
        >
          <div className="gutter hours">
            {HOURS.map((h) => (
              <div
                key={h}
                className="hour-label"
                style={{ top: h * 60 * PX_PER_MINUTE }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayStart = startOfDay(day)
            const dayEnd = addDays(dayStart, 1)
            const dayEvents = events.filter((e) => {
              if (e.all_day) return false
              const s = new Date(e.starts_at)
              const en = new Date(e.ends_at)
              return s < dayEnd && en > dayStart
            })

            return (
              <div key={day.toISOString()} className="day-col">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="hour-line"
                    style={{ top: h * 60 * PX_PER_MINUTE }}
                  />
                ))}

                {isToday(day) && (
                  <div
                    className="now-line"
                    style={{
                      top: minutesFromMidnight(new Date()) * PX_PER_MINUTE,
                    }}
                  />
                )}

                {dayEvents.map((e) => {
                  const top =
                    clampMinutes(new Date(e.starts_at), dayStart, dayEnd) *
                    PX_PER_MINUTE
                  const bottom =
                    clampMinutes(new Date(e.ends_at), dayStart, dayEnd) *
                    PX_PER_MINUTE
                  const height = Math.max(bottom - top, 22)
                  return (
                    <button
                      key={e.id}
                      className={`event cat-${e.category}`}
                      style={{ top, height }}
                      onClick={() => onSelect(e)}
                      title={e.notes ?? e.title}
                    >
                      <span className="event-title">{e.title}</span>
                      <span className="event-time">
                        {formatTime(e.starts_at)} – {formatTime(e.ends_at)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
