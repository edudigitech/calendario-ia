import type { Config, Context } from '@netlify/functions'
import type Stripe from 'stripe'
import { adminClient } from '../lib/auth'
import { stripeClient } from '../lib/stripe'

/**
 * POST /api/stripe-webhook
 *
 * Aquí (y no en la página de éxito) se entregan los créditos: el usuario puede
 * cerrar la pestaña justo después de pagar, y algunos métodos de pago confirman
 * más tarde. Stripe reintenta los webhooks fallidos, así que la entrega tiene
 * que ser idempotente; eso lo garantiza `grant_credits` con el índice único
 * sobre `stripe_session_id`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 })
  }

  const stripe = stripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    console.error('webhook: falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET')
    return new Response('Pagos sin configurar', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Falta la firma', { status: 400 })
  }

  // Hay que verificar sobre el cuerpo crudo, no sobre el JSON ya parseado:
  // el mínimo cambio de formato invalida la firma.
  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('webhook: firma inválida:', message)
    return new Response('Firma inválida', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session

      // Con métodos de confirmación diferida, `completed` llega aún sin pagar.
      if (session.payment_status === 'unpaid') {
        console.log(
          'webhook: sesión %s completada pero sin pagar (se espera confirmación)',
          session.id,
        )
        return Response.json({ received: true, pending: true })
      }

      const userId =
        session.client_reference_id ?? session.metadata?.user_id ?? null
      const credits = Number(session.metadata?.credits ?? 0)

      if (!userId || !UUID.test(userId)) {
        console.error(
          'webhook: sesión %s sin user_id válido (client_reference_id=%s)',
          session.id,
          String(session.client_reference_id),
        )
        return Response.json({ received: true, ignored: 'sin usuario' })
      }

      if (!Number.isFinite(credits) || credits <= 0) {
        console.error(
          'webhook: sesión %s con créditos no válidos (%s)',
          session.id,
          String(session.metadata?.credits),
        )
        return Response.json({ received: true, ignored: 'sin créditos' })
      }

      const admin = adminClient()
      if (!admin) {
        console.error('webhook: falta SUPABASE_SERVICE_ROLE_KEY')
        return new Response('Base de datos sin configurar', { status: 503 })
      }

      const paymentIntent =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null)

      const { data, error } = await admin.rpc('grant_credits', {
        p_user_id: userId,
        p_credits: credits,
        p_session_id: session.id,
        p_payment_intent_id: paymentIntent,
        p_amount_total: session.amount_total ?? 0,
        p_currency: session.currency ?? 'eur',
      })

      if (error) {
        // 500 para que Stripe reintente; grant_credits es idempotente.
        console.error('webhook: grant_credits falló:', error.message)
        return new Response('No se pudieron entregar los créditos', {
          status: 500,
        })
      }

      console.log(
        'webhook: %s créditos entregados al usuario %s (sesión %s)',
        credits,
        userId,
        session.id,
      )

      return Response.json({ received: true, granted: credits, purchase: data })
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.warn('webhook: pago diferido fallido en la sesión %s', session.id)
      return Response.json({ received: true })
    }

    default:
      return Response.json({ received: true, ignored: event.type })
  }
}

export const config: Config = { path: '/api/stripe-webhook' }
