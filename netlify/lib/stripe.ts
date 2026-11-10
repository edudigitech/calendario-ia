import Stripe from 'stripe'

let cached: Stripe | null = null

/**
 * Cliente de Stripe para las funciones. La clave vive solo en el entorno de
 * Netlify: nunca se compila dentro del JavaScript que baja al navegador.
 */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  cached ??= new Stripe(key, { maxNetworkRetries: 2 })
  return cached
}

/** Precio del pack (creado en el Dashboard / con el CLI). */
export function priceId(): string | null {
  return process.env.STRIPE_PRICE_CREDITS ?? null
}

/** Cuántos análisis trae cada pack. */
export function creditsPerPack(): number {
  const raw = Number(process.env.STRIPE_CREDITS_PER_PACK ?? '100')
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 100
}

/**
 * Etiqueta que Stripe usa para agrupar estos Checkout en el Dashboard.
 * Debe llevar un sufijo de 8 letras aleatorias y no cambiar entre pagos,
 * si no las comparaciones del Dashboard dejan de tener sentido.
 */
export const INTEGRATION_IDENTIFIER = 'calendario_ia_credits_k3m9p2q1'
