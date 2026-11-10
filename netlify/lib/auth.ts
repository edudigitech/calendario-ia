import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Utilidades compartidas por las funciones de Netlify: comprobar la sesión del
 * usuario y hablar con Supabase como backend (service_role).
 *
 * La clave pública solo sirve para validar el JWT del usuario. Para escribir de
 * verdad (créditos, compras) se usa la service_role, que nunca llega al navegador.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ''

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  ''

export type AuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: number; error: string }

/**
 * Comprueba el token del usuario contra Supabase. Sin esto, cualquiera podría
 * llamar a /api/parse y gastar el AI Gateway, o abrir un Checkout a su nombre.
 */
export async function verifyUser(req: Request): Promise<AuthResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('faltan VITE_SUPABASE_URL o la clave pública en el entorno')
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
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: header },
    })
    if (!res.ok) {
      return {
        ok: false,
        status: 401,
        error: 'Tu sesión no es válida o ha caducado.',
      }
    }
    const user = (await res.json()) as { id?: string; email?: string } | null
    if (!user?.id) {
      return {
        ok: false,
        status: 401,
        error: 'Tu sesión no es válida o ha caducado.',
      }
    }
    return { ok: true, userId: user.id, email: user.email ?? null }
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'No he podido comprobar tu sesión. Inténtalo otra vez.',
    }
  }
}

/** Cliente con permisos de servidor. Solo para las funciones de Netlify. */
export function adminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** URL del sitio para las redirecciones de Stripe, sin aceptar cualquier Origin. */
export function siteUrl(req: Request): string {
  const fallback = process.env.URL ?? 'https://calendario-ia-rb7k.netlify.app'
  const allowed = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    'http://localhost:8888',
    'http://localhost:5173',
  ].filter((value): value is string => Boolean(value))

  const origin = req.headers.get('origin')
  if (origin && allowed.includes(origin)) return origin
  return fallback
}
