import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { WEEK_OPTS, formatTime } from '../lib/dates'
import type { CalendarEvent } from '../lib/types'

interface Props {
  cursor: Date
  events: CalendarEvent[]
  onSelectDay: (day: Date) => void
  onSelectEvent: (event: CalendarEvent) => void
}

export default function MonthGrid({
  cursor,
  events,
  onSelectDay,
  onSelectEvent,
}: Props) {
  const first = startOfWeek(startOfMonth(cursor), WEEK_OPTS)
  const last = endOfWeek(endOfMonth(cursor), WEEK_OPTS)
  const days: Date[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d)

  return (
    <div className="monthgrid">
      <div className="monthgrid-head">
        {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => (
          <div key={d} className="monthgrid-dow">
            {d}
          </div>
        ))}
      </div>
      <div className="monthgrid-body">
        {days.map((day) => {
          const dayEvents = events
            .filter((e) => isSameDay(new Date(e.starts_at), day))
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          const visible = dayEvents.slice(0, 3)
          const extra = dayEvents.length - visible.length

          return (
            <div
              key={day.toISOString()}
              className={[
                'monthcell',
                isSameMonth(day, cursor) ? '' : 'is-outside',
                isToday(day) ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDay(day)}
            >
              <span className="monthcell-num">{format(day, 'd')}</span>
              <div className="monthcell-events">
                {visible.map((e) => (
                  <button
                    key={e.id}
                    className={`chip cat-${e.category}`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onSelectEvent(e)
                    }}
                  >
                    {!e.all_day && (
                      <span className="chip-time">{formatTime(e.starts_at)}</span>
                    )}
                    {e.title}
                  </button>
                ))}
                {extra > 0 && (
                  <span className="monthcell-more">+{extra} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
