import type { Config, Context } from '@netlify/functions'
import OpenAI from 'openai'

const CATEGORIES = [
  'trabajo',
  'personal',
  'estudio',
  'salud',
  'ocio',
  'otro',
] as const

type Category = (typeof CATEGORIES)[number]

interface Draft {
  title: string
  notes: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
  category: Category
}

const MODEL = process.env.AI_MODEL ?? 'gpt-5-mini'

// Las variables están en el sitio como VITE_* (las usa el cliente); en las
// funciones se leen igual porque Netlify expone todas las del sitio.
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ''

type AuthResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Comprueba el token del usuario contra Supabase. Sin esto, cualquiera podría
 * llamar a /api/parse y gastar el AI Gateway.
 */
async function verifyUser(req: Request): Promise<AuthResult> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('parse-plan: faltan VITE_SUPABASE_URL o la clave pública')
    return {
      ok: false,
      status: 503,
      error: 'El servidor no tiene configurada la verificación de sesión.',
    }
  }

  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Tienes que iniciar sesión.' }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY, Authorization: header },
    })
    if (!res.ok) {
      return {
        ok: false,
        status: 401,
        error: 'Tu sesión no es válida o ha caducado.',
      }
    }
    const user = (await res.json()) as { id?: string } | null
    if (!user?.id) {
      return {
        ok: false,
        status: 401,
        error: 'Tu sesión no es válida o ha caducado.',
      }
    }
    return { ok: true }
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'No he podido comprobar tu sesión. Inténtalo otra vez.',
    }
  }
}

function systemPrompt(now: string, tz: string): string {
  return `Convierte el texto del usuario en eventos de calendario.

Fecha y hora actual: ${now}
Zona horaria del usuario: ${tz}

Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma:
{"events":[{"title":"...","notes":null,"starts_at":"...","ends_at":"...","all_day":false,"category":"trabajo"}]}

Reglas:
- starts_at y ends_at deben ser ISO 8601 con offset explícito, calculados en la zona ${tz}.
  Ejemplo válido: 2026-10-21T08:00:00+02:00
- Interpreta fechas relativas ("mañana", "el lunes", "esta semana", "el 25") respecto a la fecha actual indicada arriba.
- Si el texto no indica hora, usa all_day=true y cubre el día completo (00:00 a 23:59 en esa zona).
- Si indica hora de inicio pero no de fin, asume 1 hora de duración.
- No inventes eventos que no aparezcan en el texto.
- category debe ser exactamente una de: ${CATEGORIES.join(', ')}.
- title debe ser corto y claro (máximo 60 caracteres) y no incluir la fecha.
- notes puede ser null o un detalle breve del evento.
- Si el texto no contiene ningún evento reconocible, devuelve {"events":[]}.
- No añadas explicaciones ni markdown: solo el JSON.`
}

function normalise(raw: unknown): Draft[] {
  if (!raw || typeof raw !== 'object') return []
  const list = (raw as { events?: unknown }).events
  if (!Array.isArray(list)) return []

  const out: Draft[] = []

  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>

    const startsRaw = typeof e.starts_at === 'string' ? e.starts_at : null
    if (!startsRaw) continue

    const starts = new Date(startsRaw)
    if (Number.isNaN(starts.getTime())) continue

    let ends = typeof e.ends_at === 'string' ? new Date(e.ends_at) : null
    if (!ends || Number.isNaN(ends.getTime()) || ends <= starts) {
      ends = new Date(starts.getTime() + 60 * 60 * 1000)
    }

    const category = CATEGORIES.includes(e.category as Category)
      ? (e.category as Category)
      : 'otro'

    out.push({
      title: String(e.title ?? 'Evento').slice(0, 120),
      notes: typeof e.notes === 'string' && e.notes.trim() ? e.notes : null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      all_day: Boolean(e.all_day),
      category,
    })
  }

  return out
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 })
  }

  const auth = await verifyUser(req)
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await req.json().catch(() => null)) as {
    text?: string
    now?: string
    timeZone?: string
  } | null

  const text = body?.text?.trim()
  if (!text) {
    return Response.json({ error: 'Falta el texto del planning' }, { status: 400 })
  }

  if (!process.env.OPENAI_BASE_URL) {
    return Response.json(
      {
        error:
          'El AI Gateway no está activo todavía. Hace falta al menos un deploy de producción en Netlify.',
      },
      { status: 503 },
    )
  }

  const now = body?.now ?? new Date().toISOString()
  const tz = body?.timeZone ?? 'Europe/Madrid'

  try {
    const client = new OpenAI()
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(now, tz) },
        { role: 'user', content: text },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return Response.json(
        { error: 'El modelo no devolvió contenido' },
        { status: 502 },
      )
    }

    const events = normalise(JSON.parse(content))
    return Response.json({ events, model: completion.model })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('parse-plan failed:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}

export const config: Config = { path: '/api/parse' }
