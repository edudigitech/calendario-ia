import type { Config, Context } from '@netlify/functions'
import { siteUrl, verifyUser } from '../lib/auth'
import {
  INTEGRATION_IDENTIFIER,
  creditsPerPack,
  priceId,
  stripeClient,
} from '../lib/stripe'

/**
 * POST /api/checkout
 *
 * Crea una Checkout Session embebida para comprar un pack de análisis. El
 * usuario se identifica con su JWT de Supabase, nunca con un id que mande el
 * navegador. Se devuelve `clientSecret` para montarla con Stripe.js en la página.
 *
 * No se pasan `payment_method_types`: así Stripe enseña los métodos dinámicos
 * (tarjeta, Apple Pay, Google Pay, Bizum…) según el país y la moneda.
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 })
  }

  const auth = await verifyUser(req)
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status })
  }

  const stripe = stripeClient()
  const price = priceId()
  if (!stripe || !price) {
    console.error('checkout: falta STRIPE_SECRET_KEY o STRIPE_PRICE_CREDITS')
    return Response.json(
      { error: 'Los pagos no están configurados todavía.' },
      { status: 503 },
    )
  }

  const credits = creditsPerPack()
  const origin = siteUrl(req)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded_page',
      line_items: [{ price, quantity: 1 }],
      // Al terminar, Stripe redirige aquí y añade session_id.
      // El webhook es quien entrega los créditos; esta vuelta solo avisa en la UI.
      return_url: `${origin}/?checkout=ok&session_id={CHECKOUT_SESSION_ID}`,
      client_reference_id: auth.userId,
      customer_email: auth.email ?? undefined,
      metadata: {
        user_id: auth.userId,
        credits: String(credits),
      },
      payment_intent_data: {
        metadata: {
          user_id: auth.userId,
          credits: String(credits),
        },
      },
      integration_identifier: INTEGRATION_IDENTIFIER,
    })

    if (!session.client_secret) {
      return Response.json(
        { error: 'Stripe no devolvió la sesión de pago.' },
        { status: 502 },
      )
    }

    return Response.json({ clientSecret: session.client_secret })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('checkout falló:', message)
    return Response.json(
      { error: 'No he podido abrir el pago. Inténtalo otra vez.' },
      { status: 500 },
    )
  }
}

export const config: Config = { path: '/api/checkout' }
