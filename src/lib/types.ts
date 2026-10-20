export const CATEGORIES = [
  'trabajo',
  'personal',
  'estudio',
  'salud',
  'ocio',
  'otro',
] as const

export type Category = (typeof CATEGORIES)[number]

export interface CalendarEvent {
  id: string
  title: string
  notes: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  category: Category
  source_text: string | null
  created_at: string
}

export type EventDraft = Omit<CalendarEvent, 'id' | 'created_at'>

/** Campos que se pueden editar desde el diálogo de evento. */
export type EventUpdate = Pick<
  CalendarEvent,
  'title' | 'notes' | 'starts_at' | 'ends_at' | 'all_day' | 'category'
>

export type ViewMode = 'day' | 'week' | 'month'
