import { supabase } from './supabase'

export const CREDITS_TABLE = 'credit_balances'

/** Lo que trae el pack. Debe coincidir con `STRIPE_CREDITS_PER_PACK`. */
export const PACK_CREDITS = 100

/** Solo para enseñarlo; el precio de verdad lo manda Stripe. */
export const PACK_PRICE = '4,99 €'

/** Saldo de análisis del usuario. La RLS ya limita la fila a la suya. */
export async function fetchCredits(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from(CREDITS_TABLE)
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as { balance: number } | null)?.balance ?? 0
}

/** Pide una Checkout Session embebida al servidor y devuelve su client_secret. */
export async function startCheckout(accessToken: string): Promise<string> {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const json = (await res.json().catch(() => ({}))) as {
    clientSecret?: string
    error?: string
  }

  if (!res.ok) {
    throw new Error(json.error ?? 'No se pudo abrir el pago.')
  }
  if (!json.clientSecret) {
    throw new Error('Stripe no devolvió la sesión de pago.')
  }
  return json.clientSecret
}
