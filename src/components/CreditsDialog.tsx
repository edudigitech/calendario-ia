import { loadStripe } from '@stripe/stripe-js'
import type { StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { useEffect, useRef, useState } from 'react'
import { PACK_CREDITS, PACK_PRICE, startCheckout } from '../lib/credits'

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '',
)

interface Props {
  accessToken: string
  credits: number | null
  onClose: () => void
}

export default function CreditsDialog({ accessToken, credits, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  useEffect(() => {
    return () => {
      checkoutRef.current?.destroy()
      checkoutRef.current = null
    }
  }, [])

  async function buy() {
    if (busy || checkoutRef.current) return
    setBusy(true)
    setError(null)
    try {
      const stripe = await stripePromise
      if (!stripe) {
        throw new Error('El pago no está configurado (falta la clave pública).')
      }

      const clientSecret = await startCheckout(accessToken)
      const checkout = await stripe.createEmbeddedCheckoutPage({
        clientSecret,
        onComplete: () => {
          // Stripe redirige a return_url; no hace falta hacer nada aquí.
        },
      })

      const node = containerRef.current
      if (!node) {
        checkout.destroy()
        throw new Error('No se pudo mostrar el formulario de pago.')
      }

      checkout.mount(node)
      checkoutRef.current = checkout
      setReady(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className={ready ? 'modal-card modal-card-wide' : 'modal-card'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-dialog-title"
      >
        <div className="modal-head">
          <h2 id="credits-dialog-title">Análisis de IA</h2>
          <button
            type="button"
            className="ghost icon"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        {!ready && (
          <>
            <p className="modal-text">
              Cada vez que pides un planning, la IA lo convierte en eventos y
              gasta un análisis. Te quedan{' '}
              <strong>{credits === null ? '…' : credits}</strong>.
            </p>

            <div className="pack">
              <div>
                <p className="pack-title">Pack de {PACK_CREDITS} análisis</p>
                <p className="pack-sub">Pago único, sin suscripción</p>
              </div>
              <span className="pack-price">{PACK_PRICE}</span>
            </div>

            {error && <p className="panel-error">{error}</p>}

            <div className="modal-actions">
              <span className="spacer" />
              <button
                type="button"
                className="ghost"
                onClick={onClose}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => void buy()}
                disabled={busy}
              >
                {busy ? 'Cargando el pago…' : `Pagar ${PACK_PRICE}`}
              </button>
            </div>

            <p className="pack-note">
              El pago se procesa en Stripe. No guardamos datos de tarjeta.
            </p>
          </>
        )}

        {ready && error && <p className="panel-error">{error}</p>}

        <div
          ref={containerRef}
          id="embedded-checkout"
          className={ready ? 'embedded-checkout' : 'embedded-checkout hidden'}
        />
      </div>
    </div>
  )
}
